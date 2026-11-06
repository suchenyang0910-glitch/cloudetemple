import test from "node:test";
import assert from "node:assert/strict";
import { openStore } from "./store.mjs";
import { openFamilyStore } from "./family-store.mjs";
import { createFamilyApi } from "./family-api.mjs";
import { createServer } from "./app.mjs";
import { listOutbox } from "./outbox-staging.mjs";
import { hash } from "./security.mjs";
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
};
async function fixture() {
  const store = openStore(":memory:"),
    family = openFamilyStore(store.db),
    server = createServer(
      settings,
      store,
      async () => {},
      createFamilyApi(settings, family),
    );
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
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
test("email code stays in protected outbox and session CRUD enforces CSRF", async () => {
  const f = await fixture();
  try {
    let r = await f.request("/family/auth/email/start", {
      method: "POST",
      body: JSON.stringify({ email: "demo@example.com" }),
    });
    assert.equal(r.status, 201);
    const message = listOutbox(f.family.db)[0],
      code = message.text_body.match(/\b\d{6}\b/)[0];
    r = await f.request("/family/auth/email/verify", {
      method: "POST",
      body: JSON.stringify({ email: "demo@example.com", code }),
    });
    assert.equal(r.status, 200);
    const data = await r.json(),
      cookie = r.headers.get("set-cookie").split(";")[0];
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
    r = await f.request("/family/tablets", { headers: { Cookie: cookie } });
    assert.equal((await r.json()).tablets.length, 1);
    r = await f.request(`/family/tablets/${tablet.id}/offerings`, {
      method: "POST",
      headers: { Cookie: cookie, "X-CSRF-Token": data.csrf },
      body: JSON.stringify({ kind: "incense" }),
    });
    assert.equal((await r.json()).count, 1);
    r = await f.request("/family/account/export", {
      headers: { Cookie: cookie },
    });
    const exported = await r.json();
    assert.equal(exported.data.tablets.length, 1);
    assert.equal(exported.data.offerings.length, 1);
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
  const f = await fixture();
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
  } finally {
    await new Promise((resolve) => f.server.close(resolve));
    f.store.close();
  }
});
