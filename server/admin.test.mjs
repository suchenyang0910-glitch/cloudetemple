import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { openStore } from "./store.mjs";
import { openMetricsStore } from "./metrics-store.mjs";
import { openFamilyStore } from "./family-store.mjs";
import { createAccessVerifier } from "./access-auth.mjs";
import { createMetricsApi } from "./metrics-api.mjs";
import { createServer } from "./app.mjs";
import { config } from "./security.mjs";

const now = 1800000000000, DAY = 86400000, team = "safe-team.cloudflareaccess.com", audience = "audience_12345678", email = "admin@example.invalid";
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 }), jwk = { ...publicKey.export({ format: "jwk" }), kid: "key-1", alg: "RS256", use: "sig" };
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const jwt = (patch = {}) => { const header = encode({ alg: "RS256", kid: "key-1", typ: "JWT" }), payload = encode({ iss: `https://${team}`, aud: [audience], email, type: "app", nbf: now / 1000 - 10, exp: now / 1000 + 300, ...patch }), data = `${header}.${payload}`; return `${data}.${sign("RSA-SHA256", Buffer.from(data), privateKey).toString("base64url")}`; };
const settings = { adminEnabled: true, referralsEnabled: true, presenceEnabled: true, accessTeamDomain: team, accessAud: audience, adminEmails: new Set([email]), hashSecret: "x".repeat(64), origins: new Set(), familyEnabled: true, beadGuruRule: "turn-back", mailProvider: "outbox", telegramEnabled: false, adminOpsPath: "missing-admin-ops.json", trustLocal: false };
const fetchKeys = async () => new Response(JSON.stringify({ keys: [jwk] }), { status: 200, headers: { "Content-Type": "application/json" } });

test("Access JWT requires signature, iss, aud, time, app type and allowlisted email", async () => {
  const verifier = createAccessVerifier(settings, fetchKeys, () => now);
  assert.equal(await verifier.validate(jwt()), email);
  for (const token of ["", jwt({ exp: now / 1000 - 31 }), jwt({ nbf: now / 1000 + 31 }), jwt({ iss: "https://wrong.example" }), jwt({ aud: ["wrong"] }), jwt({ type: "org" }), jwt({ email: "other@example.invalid" }), jwt().slice(0, -2) + "aa"]) await assert.rejects(verifier.validate(token));
});

test("JWKS refreshes when a key id is initially unknown", async () => {
  let calls = 0;
  const verifier = createAccessVerifier(settings, async () => { calls++; return new Response(JSON.stringify({ keys: calls === 1 ? [] : [jwk] }), { status: 200 }); }, () => now);
  assert.equal(await verifier.validate(jwt()), email); assert.equal(calls, 2);
});

test("referral binding is first-touch, private, deletable and small cohorts are suppressed", () => {
  const database = openStore(":memory:"), store = openMetricsStore(database.db);
  try {
    for (let i = 0; i < 6; i++) store.identity(`person-${i}`, `abcd234${i + 2}`);
    assert.equal(store.bind("person-1", "abcd2342", "zalo", "sit", now), "bound");
    assert.equal(store.bind("person-1", "abcd2344", "facebook", "bow", now), "existing");
    assert.equal(store.bind("person-2", "abcd2344", "zalo", "sit", now), "ignored");
    assert.deepEqual(store.mine("person-0"), { direct: 1, second: 0, channels: [{ key: "zalo", status: "insufficient" }] });
    const summary = store.summary(); assert.equal(summary.referrals.tree.status, "ok"); assert(summary.referrals.tree.nodes.every((node) => /^A-\d{3}$/.test(node.id))); assert(!JSON.stringify(summary).includes("abcd234"));
    store.remove("person-1"); assert.equal(store.summary().referrals.bindings, 0);
  } finally { database.close(); }
});

test("reminder return rate counts only incense within three days and suppresses cohorts below five", () => {
  const database = openStore(":memory:"); openFamilyStore(database.db); const store = openMetricsStore(database.db), sent = new Date(Date.now() - DAY).toISOString();
  try {
    for (let i = 0; i < 5; i++) database.db.prepare("INSERT INTO users(id,created_at) VALUES(?,?)").run(`user-${i}`, sent);
    database.db.prepare("INSERT INTO tablets(id,owner_id,honorific,full_name,death_lunar_day,death_lunar_month,created_at) VALUES('tablet','user-0','Ông','Synthetic',1,1,?)").run(sent);
    for (let i = 0; i < 5; i++) {
      database.db.prepare("INSERT INTO deliveries(id,user_id,tablet_id,kind,due_date,channel,sent_at,status,created_at) VALUES(?,?, 'tablet','death-7','2026-11-06','email',?,'sent',?)").run(`delivery-${i}`, `user-${i}`, sent, sent);
      if (i < 3) database.db.prepare("INSERT INTO offerings(id,tablet_id,user_id,kind,at,created_at) VALUES(?, 'tablet',?,'incense',?,?)").run(`offering-${i}`, `user-${i}`, new Date(Date.parse(sent) + DAY).toISOString(), sent);
    }
    assert.equal(store.summary().family.reminderReturn, 0.6);
    database.db.prepare("DELETE FROM deliveries WHERE id='delivery-4'").run();
    assert.equal(store.summary().family.reminderReturn, null);
  } finally { database.close(); }
});

test("presence keeps temporary ids only in memory and stores five-minute numeric aggregates", () => {
  const database = openStore(":memory:"), store = openMetricsStore(database.db), at = Date.now();
  try {
    for (let i = 0; i < 4; i++) assert.equal(store.heartbeat(`temporary-${i}`, at), true);
    assert.equal(store.samplePresence(at), 4);
    assert.equal(store.summary().presence.hours[0].status, "insufficient");
    assert.equal(store.heartbeat("temporary-4", at + 1000), true);
    assert.equal(store.heartbeat("temporary-4", at + 2000), true);
    assert.equal(store.samplePresence(at + 2000), 5);
    assert.deepEqual(store.summary().presence.hours[0], { key: new Date(at).toISOString().slice(0, 13) + ":00:00.000Z", peak: 5, average: 4.5, samples: 2 });
    assert.deepEqual(database.db.prepare("PRAGMA table_info(presence_5m)").all().map(({ name, type }) => ({ name, type })), [
      { name: "bucket", type: "TEXT" }, { name: "peak", type: "INTEGER" }, { name: "total", type: "INTEGER" }, { name: "samples", type: "INTEGER" },
    ]);
    assert(!JSON.stringify(database.db.prepare("SELECT * FROM presence_5m").all()).includes("temporary"));
    assert.equal(store.samplePresence(at + 78001), 0);
  } finally { database.close(); }
});

test("presence heartbeat accepts one UUID field from a browser and rejects unsafe input", async (t) => {
  const database = openStore(":memory:"), metrics = openMetricsStore(database.db), server = createServer(settings, database, async () => {}, createMetricsApi(settings, metrics, { validate: async () => email }));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve)); t.after(async () => { await new Promise((resolve) => server.close(resolve)); database.close(); });
  const base = `http://127.0.0.1:${server.address().port}/presence/heartbeat`, request = (body, headers = {}) => fetch(base, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
  const id = "00000000-0000-4000-8000-000000000001";
  assert.equal((await request({ id })).status, 403);
  assert.equal((await request({ id: "bad" }, { "Sec-Fetch-Site": "same-origin" })).status, 400);
  assert.equal((await request({ id, account: "forbidden" }, { "Sec-Fetch-Site": "same-origin" })).status, 400);
  assert.equal((await request({ id }, { "Sec-Fetch-Site": "same-origin" })).status, 204);
  assert.equal((await request({ id }, { "Sec-Fetch-Site": "same-origin" })).status, 204);
  assert.equal(metrics.samplePresence(), 1);
});

test("admin endpoint is read-only, writes audit and returns only allowlisted aggregate fields", async (t) => {
  const database = openStore(":memory:"), family = openFamilyStore(database.db), metrics = openMetricsStore(database.db), access = createAccessVerifier(settings, fetchKeys, () => now), server = createServer(settings, database, async () => {}, createMetricsApi(settings, metrics, access, family));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve)); t.after(async () => { await new Promise((resolve) => server.close(resolve)); database.close(); });
  const base = `http://127.0.0.1:${server.address().port}`, request = (token, method = "GET", path = "summary") => fetch(`${base}/admin/${path}`, { method, headers: token ? { "Cf-Access-Jwt-Assertion": token } : {} });
  assert.equal((await request("")).status, 403); assert.equal((await request(jwt({ aud: ["wrong"] }))).status, 403); assert.equal((await request(jwt(), "POST")).status, 403);
  metrics.error("api_5xx"); metrics.count("memorial_view"); metrics.count("offering_complete", "incense"); const response = await request(jwt()); assert.equal(response.status, 200); const data = await response.json();
  const allowed = new Set(["ok","data","overview","counters","day","metric","dimension","value","presence","hours","peak","average","samples","referrals","identities","bindings","k","channels","activities","tree","status","nodes","edges","id","from","to","key","subjects","family","tablets","members","invites","accepted","averageMembers","inviteAcceptance","reminderReturn","metrics","memorial_view","offering_complete","member_invite_accept","reminder_set","ics_export","calendar_pdf_view","deliveries","operations","release","api","backupAt","backupCheck","certificateExpires","diskFreeBytes","errors","category","count","at","features","beadGuruRule","guideNoindex","mailProvider","telegram"]);
  const walk = (value) => { if (Array.isArray(value)) return value.forEach(walk); if (value && typeof value === "object") for (const [key, item] of Object.entries(value)) { assert(allowed.has(key), `unexpected admin field ${key}`); walk(item); } }; walk(data);
  const serialized = JSON.stringify(data); for (const forbidden of ["full_name","email","death_","token","referral_code","query","body","raw"]) assert(!serialized.toLowerCase().includes(forbidden));
  assert.equal(data.data.operations.errors[0].category, "api_5xx"); assert.equal(data.data.operations.errors[0].count, 1);
  assert.deepEqual(data.data.family.metrics, { memorial_view: 1, offering_complete: 1 });
  assert.equal(database.db.prepare("SELECT count(*) n FROM admin_audit").get().n, 1);
  family.createInterest({ name: "Synthetic", contact: "contact-test", ancestorCount: "1-2", willingness: "none", region: "" });
  const presale = await request(jwt(), "GET", "presale"); assert.equal(presale.status, 200); const listed = await presale.json(); assert.equal(listed.data.interests[0].contact, "contact-test"); assert.equal(database.db.prepare("SELECT count(*) n FROM admin_audit").get().n, 2);
});

test("server observer receives 5xx status without request content", async (t) => {
  const database = openStore(":memory:"), seen = [], server = createServer(settings, database, async () => {}, async (_req, res) => { res.writeHead(503); res.end(); return true; }, (status) => seen.push(status));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve)); t.after(async () => { await new Promise((resolve) => server.close(resolve)); database.close(); });
  assert.equal((await fetch(`http://127.0.0.1:${server.address().port}/synthetic`)).status, 503); await new Promise((resolve) => setImmediate(resolve)); assert.deepEqual(seen, [503]);
});

test("declined referral records only a click; daily binding cap and account merge prevent abuse", async (t) => {
  const database = openStore(":memory:"), metricsStore = openMetricsStore(database.db), referrer = metricsStore.identity("source", "abcd2342"), server = createServer(settings, database, async () => {}, createMetricsApi(settings, metricsStore, { validate: async () => email }));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve)); t.after(async () => { await new Promise((resolve) => server.close(resolve)); database.close(); });
  const response = await fetch(`http://127.0.0.1:${server.address().port}/referrals/bind`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ referralCode: referrer, channel: "zalo", activity: "sit", consent: false }) });
  assert.equal(response.status, 202); assert.equal(database.db.prepare("SELECT count(*) n FROM referral_identities").get().n, 1); assert.equal(database.db.prepare("SELECT value FROM referral_clicks").get().value, 1);
  for (let i = 0; i < 201; i++) { const id = `guest-${i}`; metricsStore.identity(id); assert.equal(metricsStore.bind(id, referrer, "copy", "recommend", now), i < 200 ? "bound" : "limited"); }
  metricsStore.identity("account-a"); metricsStore.identity("account-b", "abcd2343"); assert.equal(metricsStore.bind("account-b", referrer, "copy", "recommend", now + DAY), "bound"); metricsStore.merge("source", "same-account"); metricsStore.merge("account-b", "same-account"); assert.equal(database.db.prepare("SELECT count(*) n FROM referral_bindings WHERE referee_hash='account-b'").get().n, 0);
});

test("admin and referral switches default off in production and fail closed", () => {
  const base = { TELEGRAM_ENABLED: "0", HASH_SECRET: "x".repeat(64), CHUAMAY_ENV: "production" };
  assert.equal(config(base).adminEnabled, false); assert.equal(config(base).referralsEnabled, false);
  assert.equal(config(base).presenceEnabled, false);
  assert.equal(config({ ...base, CALENDAR_PREORDER_PRICE: "150000", CALENDAR_PREORDER_DEADLINE: "2026-12-20", CALENDAR_PAYMENT_BANK: "Bank", CALENDAR_PAYMENT_NAME: "Name", CALENDAR_PAYMENT_ACCOUNT: "0000" }).calendarPresale.open, false);
  assert.throws(() => config({ ...base, ADMIN_ENABLED: "1" }), /staging-only/);
  assert.throws(() => config({ ...base, CHUAMAY_ENV: "staging", ADMIN_ENABLED: "1" }), /admin access/);
  const staged = config({ ...base, CHUAMAY_ENV: "staging", ADMIN_ENABLED: "1", CF_ACCESS_TEAM_DOMAIN: team, CF_ACCESS_AUD: audience, ADMIN_EMAILS: email });
  assert.equal(staged.adminEmails.size, 1); assert.equal(staged.referralsEnabled, true); assert.equal(staged.presenceEnabled, true);
  assert.throws(() => config({ ...base, PRESENCE_ENABLED: "yes" }), /PRESENCE_ENABLED/);
});
