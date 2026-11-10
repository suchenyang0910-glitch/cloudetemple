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
  familyAllowlist: new Set(["demo@example.com", "member@example.com"]),
  origins: new Set(["https://staging.chuamay.org"]),
  hashSecret: "x".repeat(64),
  environment: "staging",
  mailProvider: "outbox",
  mailFrom: "test@example.invalid",
  familyUrl: "https://staging.chuamay.org/family.html",
  lunarLeapRule: "regular-month",
  trustLocal: false,
};
async function fixture(options = settings) {
  const store = openStore(":memory:"),
    family = openFamilyStore(store.db),
    server = createServer(
      options,
      store,
      async () => {},
      createFamilyApi(options, family),
    );
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base,
    store,
    family,
    server,
    request: (path, requestOptions = {}) =>
      fetch(base + path, {
        ...requestOptions,
        headers: {
          Origin: options.origins.values().next().value,
          "Content-Type": "application/json",
          ...requestOptions.headers,
        },
      }),
  };
}
test("email code stays in protected outbox and session CRUD enforces CSRF", async () => {
  assert.throws(
    () => familyServerText("otp_text"),
    /family_copy_param/,
  );
  assert.throws(
    () => familyServerText("otp_subject", { code: "123456" }),
    /family_copy_param/,
  );
  const f = await fixture();
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
    r = await f.request("/family/status", {
      method: "GET",
      headers: { Cookie: cookie },
    });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).enabled, true);
    r = await f.request("/family/consent", { headers: { Cookie: cookie } });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).accepted, false);
    r = await f.request("/family/consent", {
      method: "POST",
      headers: { Cookie: cookie, "X-CSRF-Token": data.csrf },
      body: JSON.stringify({ agree: true, version: "pilot-2026-11-07-v2" }),
    });
    assert.equal(r.status, 200);
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
      headers: { Cookie: cookie, "X-CSRF-Token": data.csrf },
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
    assert.equal(exported.data.consent.version, "pilot-2026-11-07-v2");
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

test("allowlist hides status and login from other accounts", async () => {
  const f = await fixture();
  try {
    let r = await f.request("/family/status", { method: "GET" });
    assert.equal(r.status, 404);
    r = await f.request("/family/auth/email/start", {
      method: "POST",
      body: JSON.stringify({ email: "outside@example.com" }),
    });
    assert.equal(r.status, 404);
    assert.equal(listOutbox(f.family.db).length, 0);
  } finally {
    await new Promise((r) => f.server.close(r));
    f.store.close();
  }
});
test("production session cookie is shared safely across Chua May subdomains", async () => {
  const options = {
      ...settings,
      environment: "production",
      origins: new Set([
        "https://h5.chuamay.org",
        "https://miniapp.chuamay.org",
      ]),
      familyUrl: "https://h5.chuamay.org/family.html",
    },
    f = await fixture(options),
    email = "demo@example.com",
    code = "654321";
  try {
    f.family.saveCode({
      subject: hash(options.hashSecret, email),
      email,
      codeHash: hash(options.hashSecret, code),
      expires: Date.now() + 60_000,
      ipHash: "test",
    });
    const r = await f.request("/family/auth/email/verify", {
      method: "POST",
      body: JSON.stringify({ email, code }),
    });
    assert.equal(r.status, 200);
    const cookie = r.headers.get("set-cookie");
    for (const value of [
      "Domain=.chuamay.org",
      "HttpOnly",
      "Secure",
      "SameSite=Lax",
    ])
      assert(cookie.includes(value), value);
    const sessionCookie = cookie.split(";", 1)[0];
    for (const origin of [
      "https://h5.chuamay.org",
      "https://miniapp.chuamay.org",
    ]) {
      const status = await f.request("/family/status", {
        headers: {
          Cookie: sessionCookie,
          Origin: origin,
          "User-Agent": origin.includes("miniapp")
            ? "Telegram-iOS family pilot"
            : "Safari family pilot",
        },
      });
      assert.equal(status.status, 200, origin);
      assert.equal(status.headers.get("access-control-allow-origin"), origin);
      assert.equal(status.headers.get("access-control-allow-credentials"), "true");
    }
    assert.equal(
      (
        await f.request("/family/status", {
          headers: {
            Cookie: sessionCookie,
            Origin: "https://staging.chuamay.org",
          },
        })
      ).status,
      403,
    );
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
test("existing Google identity refreshes its allowlist email", () => {
  const store = openStore(":memory:"),
    family = openFamilyStore(store.db);
  try {
    const first = family.userFor("google", "subject", "", "First");
    family.userFor("google", "subject", "demo@example.com", "First");
    family.session("session", first.id, Date.now() + 60_000, "ua", "csrf");
    assert.equal(family.sessionUser("session").email, "demo@example.com");
  } finally {
    store.close();
  }
});

test("email login is rate limited and ICS is a private three-year feed", async () => {
  const f = await fixture();
  try {
    let r = await f.request("/family/auth/email/start", {
      method: "POST",
      body: JSON.stringify({ email: "demo@example.com" }),
    });
    assert.equal(r.status, 201);
    r = await f.request("/family/auth/email/start", {
      method: "POST",
      body: JSON.stringify({ email: "demo@example.com" }),
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
      body: JSON.stringify({ email: "demo@example.com" }),
    });
    assert.equal(r.status, 403);
    r = await fetch(f.base + "/family/auth/email/start", {
      method: "POST",
      headers: {
        Origin: "https://staging.chuamay.org",
        "Content-Type": "text/plain",
      },
      body: JSON.stringify({ email: "demo@example.com" }),
    });
    assert.equal(r.status, 415);
    r = await f.request("/family/auth/email/start", {
      method: "POST",
      body: JSON.stringify({ email: "demo@example.com" }),
    });
    assert.equal(r.status, 201);
  } finally {
    await new Promise((resolve) => f.server.close(resolve));
    f.store.close();
  }
});
