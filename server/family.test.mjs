import test from "node:test";
import assert from "node:assert/strict";
import { openStore } from "./store.mjs";
import { openFamilyStore } from "./family-store.mjs";
import { createFamilyApi } from "./family-api.mjs";
import { createServer } from "./app.mjs";
import { listOutbox } from "./outbox-staging.mjs";
import { hash } from "./security.mjs";
import { familyServerText } from "./family-i18n.mjs";
const settings = {
  telegramEnabled: false,
  origins: new Set(["https://staging.chuamay.org"]),
  hashSecret: "x".repeat(64),
  environment: "staging",
  mailProvider: "outbox",
  mailFrom: "test@example.invalid",
  familyUrl: "https://staging.chuamay.org/family.html",
  lunarLeapRule: "regular-month",
  trustLocal: false,
  calendarPresale: { open: false },
};
const acceptConsent = (f, cookie, csrf) => f.request("/family/consent", { method: "POST", headers: { Cookie: cookie, "X-CSRF-Token": csrf }, body: JSON.stringify({ agree: true, version: "pilot-2026-11-07-v2" }) });
async function fixture(dependencies, overrides = {}) {
  const configured = { ...settings, ...overrides };
  const store = openStore(":memory:"),
    family = openFamilyStore(store.db),
    server = createServer(
      configured,
      store,
      async () => {},
      createFamilyApi(configured, family, dependencies),
    );
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base,
    store,
    family,
    server,
    request: (path, options = {}) =>
      fetch(base + path, {
        ...options,
        headers: {
          Origin: "https://staging.chuamay.org",
          "Content-Type": "application/json",
          ...options.headers,
        },
      }),
  };
}
test("live staging mode keeps real records separate from demo fixtures", () => {
  const store = openStore(":memory:"),
    family = openFamilyStore(store.db, { demo: false });
  try {
    family.saveCode({
      subject: "subject",
      email: "pilot@example.invalid",
      codeHash: "code",
      expires: Date.now() + 60_000,
      ipHash: "ip",
    });
    family.saveState("state", "verifier", Date.now() + 60_000);
    const user = family.userFor(
      "email",
      "subject",
      "pilot@example.invalid",
      "Pilot",
    );
    family.session("session", user.id, Date.now() + 60_000, "test", "csrf");
    const tablet = family.createTablet(user.id, {
      honorific: "Bà ngoại",
      fullName: "Nguyễn Thị An",
      birthYear: null,
      deathYear: 2026,
      day: 12,
      month: 3,
      leap: false,
      note: "",
    });
    family.offer(user.id, tablet.id, "incense");
    family.invite(user.id, tablet.id, "invite", Date.now() + 60_000, 1);
    for (const table of [
      "users",
      "identities",
      "sessions",
      "email_codes",
      "oauth_states",
      "tablets",
      "tablet_members",
      "invites",
      "offerings",
      "reminder_prefs",
    ]) {
      assert.deepEqual(
        store.db.prepare(`SELECT DISTINCT demo FROM ${table}`).all(),
        [{ demo: 0 }],
        table,
      );
    }
  } finally {
    store.close();
  }
});
test("email code stays in protected outbox and session CRUD enforces CSRF", async () => {
  assert.throws(
    () => familyServerText("otp_text"),
    /family_copy_param/,
  );
  assert.throws(
    () => familyServerText("otp_subject", { code: "123456" }),
    /family_copy_param/,
  );
  const metrics = [], f = await fixture({ metric: (...args) => metrics.push(args) });
  try {
    let r = await f.request("/family/auth/email/start", {
      method: "POST",
      body: JSON.stringify({ email: "demo@example.com" }),
    });
    assert.equal(r.status, 201);
    const message = listOutbox(f.family.db)[0],
      code = message.text_body.match(/\b\d{6}\b/)[0];
    assert.equal(message.subject, familyServerText("otp_subject"));
    assert.equal(message.text_body, familyServerText("otp_text", { code }));
    r = await f.request("/family/auth/email/verify", {
      method: "POST",
      body: JSON.stringify({ email: "demo@example.com", code }),
    });
    assert.equal(r.status, 200);
    const data = await r.json(),
      cookie = r.headers.get("set-cookie").split(";")[0];
    assert.deepEqual(data.tablets, []);
    r = await f.request("/family/tablets", {
      method: "POST",
      headers: { Cookie: cookie },
      body: JSON.stringify({
        honorific: "Bà ngoại",
        fullName: "Nguyễn Thị An",
        day: 12,
        month: 3,
        note: "",
      }),
    });
    assert.equal(r.status, 403);
    r = await f.request("/family/tablets", {
      method: "POST",
      headers: { Cookie: cookie, "X-CSRF-Token": data.csrf },
      body: JSON.stringify({ honorific: "Bà ngoại", fullName: "Consent first", day: 12, month: 3 }),
    });
    assert.equal(r.status, 428);
    assert.equal((await r.json()).error, "consent_required");
    r = await acceptConsent(f, cookie, data.csrf);
    assert.equal(r.status, 200);
    r = await f.request("/family/tablets", {
      method: "POST",
      headers: {
        Cookie: cookie,
        "X-CSRF-Token": data.csrf,
      },
      body: JSON.stringify({
        honorific: "Bà ngoại",
        fullName: "Ngày không tồn tại",
        deathYear: 2026,
        day: 30,
        month: 2,
        note: "",
      }),
    });
    assert.equal(r.status, 400);
    assert.equal((await r.json()).error, "invalid_date");
    r = await f.request("/family/tablets", {
      method: "POST",
      headers: {
        Cookie: cookie,
        "X-CSRF-Token": data.csrf,
        "Accept-Language": "en",
      },
      body: JSON.stringify({
        honorific: "Bà ngoại",
        fullName: "Needs a year",
        day: 30,
        month: 2,
        note: "",
      }),
    });
    assert.equal(r.status, 400);
    assert.deepEqual(await r.json(), {
      ok: false,
      error: "death_year_required",
      message: familyServerText("death_year_required", {}, "en"),
    });
    r = await f.request("/family/tablets", {
      method: "POST",
      headers: {
        Cookie: cookie,
        "X-CSRF-Token": data.csrf,
      },
      body: JSON.stringify({
        honorific: "Bà ngoại",
        fullName: "Cần năm mất",
        day: 29,
        month: 2,
        leap: true,
        note: "",
      }),
    });
    assert.equal(r.status, 400);
    assert.deepEqual(await r.json(), {
      ok: false,
      error: "death_year_required",
      message: familyServerText("death_year_required"),
    });
    r = await f.request("/family/tablets", {
      method: "POST",
      headers: {
        Cookie: cookie,
        "X-CSRF-Token": data.csrf,
        "Idempotency-Key": "22222222-2222-4222-8222-222222222222",
      },
      body: JSON.stringify({
        honorific: "Bà ngoại",
        fullName: "Nguyễn Thị An",
        day: 12,
        month: 3,
        note: "",
      }),
    });
    assert.equal(r.status, 201);
    const tablet = (await r.json()).tablet;
    assert.equal(tablet.demo, 1);
    r = await f.request("/family/tablets", {
      method: "POST",
      headers: {
        Cookie: cookie,
        "X-CSRF-Token": data.csrf,
        "Idempotency-Key": "22222222-2222-4222-8222-222222222222",
      },
      body: JSON.stringify({
        honorific: "Bà ngoại",
        fullName: "Nguyễn Thị An",
        day: 12,
        month: 3,
        note: "",
      }),
    });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).tablet.id, tablet.id);
    r = await f.request("/family/tablets", { headers: { Cookie: cookie } });
    assert.equal((await r.json()).tablets.length, 1);
    r = await f.request(`/family/tablets/${tablet.id}`, { headers: { Cookie: cookie } });
    assert.equal(r.status, 200);
    r = await f.request(`/family/tablets/${tablet.id}/offerings`, {
      method: "POST",
      headers: { Cookie: cookie, "X-CSRF-Token": data.csrf },
      body: JSON.stringify({ kind: "incense" }),
    });
    assert.equal((await r.json()).count, 1);
    r = await f.request(`/family/tablets/${tablet.id}/invites`, { method: "POST", headers: { Cookie: cookie, "X-CSRF-Token": data.csrf }, body: "{}" });
    const inviteToken = new URL((await r.json()).url).hash.replace("#invite=", ""), guest = f.family.userFor("email", "guest-subject", "guest@example.invalid"), guestSession = "guest-session", guestCsrf = "guest-csrf";
    f.family.session(hash(settings.hashSecret, guestSession), guest.id, Date.now() + 60000, "test", hash(settings.hashSecret, guestCsrf));
    r = await f.request("/family/invites/accept", { method: "POST", headers: { Cookie: `ct_session=${guestSession}`, "X-CSRF-Token": guestCsrf }, body: JSON.stringify({ token: inviteToken }) });
    assert.equal(r.status, 200);
    for (const payload of [
      { kind: "solar", day: 30, month: 2, year: 2026 },
      { kind: "lunar", day: 30, month: 2, year: 2026 },
    ]) {
      r = await f.request("/family/convert", {
        method: "POST",
        headers: { Cookie: cookie, "X-CSRF-Token": data.csrf },
        body: JSON.stringify(payload),
      });
      assert.equal(r.status, 400);
      assert.equal((await r.json()).error, "invalid_date");
    }
    f.family.db.prepare("UPDATE mail_outbox SET expires_at=0").run();
    f.family.cleanup();
    assert.equal(
      f.family.db.prepare("SELECT count(*) n FROM mail_outbox").get().n,
      0,
    );
    r = await f.request("/family/account/export", {
      headers: { Cookie: cookie },
    });
    const exported = await r.json();
    assert.equal(exported.data.tablets.length, 1);
    assert.equal(exported.data.offerings.length, 1);
    r = await f.request("/family/reminders", {
      method: "PUT",
      headers: { Cookie: cookie, "X-CSRF-Token": data.csrf },
      body: JSON.stringify({ calendar: true, festival: false }),
    });
    const calendarURL = (await r.json()).calendarURL,
      calendarPath =
        new URL(calendarURL).pathname.replace(/^\/api/, "") +
        new URL(calendarURL).search;
    assert.equal((await f.request(calendarPath)).status, 200);
    r = await f.request("/family/reminders", {
      method: "PUT",
      headers: { Cookie: cookie, "X-CSRF-Token": data.csrf },
      body: JSON.stringify({ calendar: false, festival: false }),
    });
    assert.equal(r.status, 200);
    assert.equal((await f.request(calendarPath)).status, 404);
    assert.deepEqual(metrics, [["memorial_view"], ["offering_complete", "incense"], ["member_invite_accept"], ["reminder_set"], ["ics_export"], ["reminder_set"]]);
    r = await f.request("/family/account", {
      method: "DELETE",
      headers: { Cookie: cookie, "X-CSRF-Token": data.csrf },
      body: "{}",
    });
    assert.equal(r.status, 200);
    r = await f.request("/family/tablets", { headers: { Cookie: cookie } });
    assert.equal(r.status, 401);
  } finally {
    await new Promise((r) => f.server.close(r));
    f.store.close();
  }
});
test("member privacy, removal, expiry and invite revocation are enforced", () => {
  const store = openStore(":memory:"),
    f = openFamilyStore(store.db);
  try {
    const a = f.userFor("email", "a", "a@example.com"),
      b = f.userFor("email", "b", "b@example.com"),
      t = f.createTablet(a.id, {
        honorific: "Mẹ",
        fullName: "Nguyễn An",
        birthYear: null,
        deathYear: null,
        day: 1,
        month: 1,
        leap: false,
        note: "",
      });
    assert.equal(f.member(b.id, t.id), undefined);
    assert.equal(
      f.updateTablet(b.id, t.id, {
        honorific: "Mẹ",
        fullName: "X",
        birthYear: null,
        deathYear: null,
        day: 1,
        month: 1,
        leap: false,
        note: "",
      }),
      null,
    );
    const inviteId = f.invite(a.id, t.id, "invite", Date.now() + 1000, 1);
    assert(f.acceptInvite(b.id, "invite"));
    assert.equal(f.acceptInvite(b.id, "invite").role, "family");
    assert.equal(
      f.db.prepare("SELECT uses FROM invites WHERE id=?").get(inviteId).uses,
      1,
    );
    assert.equal(
      f.acceptInvite(f.userFor("email", "c", "c@example.com").id, "invite"),
      null,
    );
    assert.equal(f.member(b.id, t.id).role, "family");
    assert.equal(f.removeMember(a.id, t.id, b.id), true);
    assert.equal(f.member(b.id, t.id), undefined);
    const revoked = f.invite(a.id, t.id, "revoked", Date.now() + 1000, 20);
    assert.equal(f.revokeInvite(a.id, t.id, revoked), true);
    assert.equal(f.acceptInvite(b.id, "revoked"), null);
    f.invite(a.id, t.id, "expired", Date.now() - 1, 20);
    assert.equal(f.acceptInvite(b.id, "expired"), null);
    assert.equal(f.revokeInvite(a.id, t.id, inviteId), true);
  } finally {
    store.close();
  }
});

test("email login is rate limited and ICS is a private three-year feed", async () => {
  const metrics = [], f = await fixture({ metric: (...args) => metrics.push(args) });
  try {
    let r = await f.request("/family/auth/email/start", {
      method: "POST",
      body: JSON.stringify({ email: "rate@example.com" }),
    });
    assert.equal(r.status, 201);
    r = await f.request("/family/auth/email/start", {
      method: "POST",
      body: JSON.stringify({ email: "rate@example.com" }),
    });
    assert.equal(r.status, 429);
    const owner = f.family.userFor("email", "calendar", "calendar@example.com");
    f.family.createTablet(owner.id, {
      honorific: "Bà ngoại",
      fullName: "Nguyễn An",
      birthYear: null,
      deathYear: null,
      day: 12,
      month: 3,
      leap: false,
      note: "",
    });
    f.family.setPrefs(owner.id, {
      email: false,
      telegram: false,
      festival: false,
      telegramChat: null,
      icsHash: hash(settings.hashSecret, "calendar-token"),
    });
    r = await f.request("/family/calendar.ics?token=calendar-token");
    assert.equal(r.status, 200);
    assert.match(r.headers.get("content-type"), /^text\/calendar/);
    assert.match(r.headers.get("cache-control"), /private/);
    const ics = await r.text();
    assert.match(ics, /^BEGIN:VCALENDAR\r\nVERSION:2.0/);
    assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 3);
    assert.equal((ics.match(/DTSTART;VALUE=DATE:\d{8}/g) || []).length, 3);
    assert.match(
      ics,
      new RegExp(
        `SUMMARY:${familyServerText("calendar_anniversary", { honorific: "Bà ngoại" })}`,
      ),
    );
    assert.match(ics, /\r\nEND:VCALENDAR$/);
    f.family.setPrefs(owner.id, {
      email: false,
      telegram: false,
      festival: true,
      telegramChat: null,
      icsHash: hash(settings.hashSecret, "calendar-token"),
    });
    r = await f.request("/family/calendar.ics?token=calendar-token");
    const festivalIcs = await r.text();
    assert.equal((festivalIcs.match(/BEGIN:VEVENT/g) || []).length, 81);
    assert.match(festivalIcs, /SUMMARY:Thanh minh/);
    assert.match(festivalIcs, /SUMMARY:Vu Lan/);
    assert.match(
      festivalIcs,
      new RegExp(`SUMMARY:${familyServerText("festival_qingming")}`),
    );
    assert.equal(f.family.revokeCalendar(owner.id), true);
    r = await f.request("/family/calendar.ics?token=calendar-token");
    assert.equal(r.status, 404);
    assert.deepEqual(metrics, [["ics_export"], ["ics_export"]]);
    const unsubscribe = `${owner.id}.${hash(
      settings.hashSecret,
      `unsubscribe:${owner.id}`,
    ).slice(0, 32)}`;
    r = await f.request(
      `/family/reminders/unsubscribe?token=${encodeURIComponent(unsubscribe)}`,
    );
    assert.equal(r.status, 200);
    assert.ok((await r.text()).includes(familyServerText("unsubscribe_done")));
  } finally {
    await new Promise((resolve) => f.server.close(resolve));
    f.store.close();
  }
});

test("every family write requires allowed Origin and JSON", async () => {
  const f = await fixture();
  try {
    let r = await fetch(f.base + "/family/auth/email/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "origin@example.com" }),
    });
    assert.equal(r.status, 403);
    r = await fetch(f.base + "/family/auth/email/start", {
      method: "POST",
      headers: {
        Origin: "https://staging.chuamay.org",
        "Content-Type": "text/plain",
      },
      body: JSON.stringify({ email: "origin@example.com" }),
    });
    assert.equal(r.status, 415);
    r = await f.request("/family/auth/email/start", {
      method: "POST",
      body: JSON.stringify({ email: "origin@example.com" }),
    });
    assert.equal(r.status, 201);
  } finally {
    await new Promise((resolve) => f.server.close(resolve));
    f.store.close();
  }
});

test("authenticated calendar PDF is private, bounded and generated without a third-party call", async () => {
  let received; const metrics = [];
  const f = await fixture({
    calendarPdf: async (input) => {
      received = input;
      return Buffer.from("%PDF-1.7\nreview\n");
    },
    metric: (...args) => metrics.push(args),
  });
  try {
    let r = await f.request("/family/auth/email/start", {
      method: "POST",
      body: JSON.stringify({ email: "calendar@example.com" }),
    });
    assert.equal(r.status, 201);
    const code = listOutbox(f.family.db)[0].text_body.match(/\b\d{6}\b/)[0];
    r = await f.request("/family/auth/email/verify", {
      method: "POST",
      body: JSON.stringify({ email: "calendar@example.com", code }),
    });
    const session = await r.json(), cookie = r.headers.get("set-cookie").split(";", 1)[0];
    assert.equal((await acceptConsent(f, cookie, session.csrf)).status, 200);
    r = await f.request("/family/tablets", {
      method: "POST",
      headers: { Cookie: cookie, "X-CSRF-Token": session.csrf },
      body: JSON.stringify({ honorific: "Bà ngoại", fullName: "Tên riêng", deathYear: 2015, day: 12, month: 3 }),
    });
    assert.equal(r.status, 201);
    r = await f.request("/family/calendar.pdf", {
      method: "POST",
      headers: { Cookie: cookie, "X-CSRF-Token": session.csrf },
      body: JSON.stringify({ familyName: "Gia đình họ Nguyễn", year: 2027 }),
    });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("content-type"), "application/pdf");
    assert.equal(r.headers.get("cache-control"), "private, no-store");
    assert.match(r.headers.get("content-disposition"), /lich-ngay-gio-2027\.pdf/);
    assert.equal(Buffer.from(await r.arrayBuffer()).subarray(0, 5).toString(), "%PDF-");
    assert.equal(received.familyName, "Gia đình họ Nguyễn");
    assert.equal(received.year, 2027);
    assert.equal(received.tablets.length, 1);
    assert.deepEqual(metrics, [["calendar_pdf_view"]]);
  } finally {
    await new Promise((resolve) => f.server.close(resolve));
    f.store.close();
  }
});

test("pilot consent, invited read-only access and account deletion cascade are enforced", () => {
  const store = openStore(":memory:"), family = openFamilyStore(store.db), owner = family.userFor("email", "owner-subject", "owner@example.invalid", "Owner"), guest = family.userFor("email", "guest-subject", "guest@example.invalid", "Guest");
  try {
    const consent = family.acceptConsent(owner.id, "pilot-2026-11-07-v2");
    assert.equal(family.consent(owner.id).version, consent.version);
    const tablet = family.createTablet(owner.id, { honorific: "Bà ngoại", fullName: "Nguyễn An", birthYear: null, deathYear: 2026, day: 12, month: 3, leap: false, note: "" });
    const inviteHash = "invite-hash";
    family.invite(owner.id, tablet.id, inviteHash, Date.now() + 60000, 1);
    assert.equal(family.acceptInvite(guest.id, inviteHash).role, "family");
    assert.equal(family.updateTablet(guest.id, tablet.id, { honorific: "X", fullName: "Y", birthYear: null, deathYear: null, day: 1, month: 1, leap: false, note: "" }), null);
    assert.equal(family.offer(guest.id, tablet.id, "incense"), null);
    assert.equal(family.leaveTablet(guest.id, tablet.id), true);
    assert.equal(family.member(guest.id, tablet.id), undefined);
    family.invite(owner.id, tablet.id, "invite-hash-2", Date.now() + 60000, 1);
    assert.equal(family.acceptInvite(guest.id, "invite-hash-2").role, "family");
    family.deleteUser(owner.id);
    for (const table of ["tablets", "tablet_members", "invites", "offerings", "family_consents"]) assert.equal(store.db.prepare(`SELECT count(*) n FROM ${table}`).get().n, 0, table);
  } finally { store.close(); }
});

test("a tablet is limited to five family members including its owner", () => {
  const store = openStore(":memory:"), family = openFamilyStore(store.db), owner = family.userFor("email", "limit-owner", "owner@example.invalid", "Owner");
  try {
    const tablet = family.createTablet(owner.id, { honorific: "Ông", fullName: "Synthetic", birthYear: null, deathYear: 2026, day: 1, month: 1, leap: false, note: "" });
    for (let index = 0; index < 5; index++) {
      const guest = family.userFor("email", `limit-${index}`, `guest-${index}@example.invalid`, `Guest ${index}`), token = `limit-token-${index}`;
      family.invite(owner.id, tablet.id, token, Date.now() + 60000, 1);
      assert.equal(!!family.acceptInvite(guest.id, token), index < 4);
    }
    assert.equal(store.db.prepare("SELECT count(*) n FROM tablet_members WHERE tablet_id=?").get(tablet.id).n, 5);
  } finally { store.close(); }
});

test("presale stays closed without server config while interest records remain separate", async () => {
  const f = await fixture();
  try {
    let response = await f.request("/family/presale/config");
    assert.deepEqual(await response.json(), { ok: true, open: false });
    response = await f.request("/family/presale/orders", { method: "POST", body: JSON.stringify({}) });
    assert.equal(response.status, 403);
    response = await f.request("/family/presale/interests", { method: "POST", body: JSON.stringify({ name: "", contact: "zalo-test", ancestorCount: "3-5", willingness: "50-99", region: "viet-nam", agree: true }) });
    assert.equal(response.status, 201);
    assert.equal(f.family.db.prepare("SELECT count(*) n FROM membership_interests").get().n, 1);
    assert.equal(f.family.db.prepare("SELECT count(*) n FROM calendar_preorders").get().n, 0);
    response = await f.request("/family/presale/interests", { method: "POST", body: JSON.stringify({ name: "功德箱", contact: "zalo-test", ancestorCount: "3-5", willingness: "50-99", region: "", agree: true }) });
    assert.equal(response.status, 400);
  } finally { await new Promise((resolve) => f.server.close(resolve)); f.store.close(); }
});

test("configured staging presale accepts at most ten manual anniversaries", async () => {
  const calendarPresale = { open: true, price: "150.000₫", familyPrice: "199.000₫", deadline: "2026-12-20", bank: "Test Bank", accountName: "Test", account: "0000", reference: "CHUAMAY-{order}" };
  const f = await fixture(undefined, { calendarPresale });
  try {
    const anniversaries = Array.from({ length: 12 }, (_, index) => ({ name: `Người ${index + 1}`, date: `${index + 1}/3 âm lịch` }));
    const response = await f.request("/family/presale/orders", { method: "POST", body: JSON.stringify({ edition: "basic", familyName: "Gia đình thử", contact: "zalo-test", anniversaries, address: "Địa chỉ thử", agree: true }) });
    assert.equal(response.status, 201);
    assert.equal(JSON.parse(f.family.db.prepare("SELECT anniversaries_json FROM calendar_preorders").get().anniversaries_json).length, 10);
  } finally { await new Promise((resolve) => f.server.close(resolve)); f.store.close(); }
});
