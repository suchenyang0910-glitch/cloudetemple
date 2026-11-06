import test from "node:test";
import assert from "node:assert/strict";
import { openStore } from "./store.mjs";
import { openFamilyStore } from "./family-store.mjs";
import { runReminders } from "./reminders.mjs";
import { solarToLunar } from "./lunar-hnd.mjs";
import { listOutbox } from "./outbox-staging.mjs";
import { familyServerText } from "./family-i18n.mjs";
test("reminder delivery is idempotent", async () => {
  const store = openStore(":memory:"),
    family = openFamilyStore(store.db);
  try {
    const u = family.userFor("email", "mail", "demo@example.com"),
      target = new Date(2027, 3, 18),
      l = solarToLunar({
        day: target.getDate(),
        month: target.getMonth() + 1,
        year: target.getFullYear(),
      });
    family.createTablet(u.id, {
      honorific: "Bà ngoại",
      fullName: "Nguyễn An",
      birthYear: null,
      deathYear: null,
      day: l.day,
      month: l.month,
      leap: l.leap,
      note: "",
    });
    family.setPrefs(u.id, {
      email: true,
      telegram: false,
      festival: false,
      telegramChat: null,
      icsHash: null,
    });
    const settings = {
      mailProvider: "outbox",
      familyUrl: "https://staging.chuamay.org/family.html",
      lunarLeapRule: "regular-month",
      telegramEnabled: false,
      hashSecret: "x".repeat(64),
    };
    const at = new Date(2027, 3, 11);
    assert.equal((await runReminders(settings, family, at)).sent, 1);
    assert.equal((await runReminders(settings, family, at)).sent, 0);
    const outbox = listOutbox(family.db);
    assert.equal(outbox.length, 1);
    assert.equal(outbox[0].subject, familyServerText("reminder_subject"));
    assert.match(
      outbox[0].text_body,
      new RegExp(`${familyServerText("reminder_unsubscribe")}:`),
    );
    assert.ok(
      outbox[0].text_body.includes(
        familyServerText("anniversary_reminder", {
          days: 7,
          honorific: "Bà ngoại",
        }),
      ),
    );
    assert.doesNotMatch(outbox[0].text_body, /demo@example\.com/);
  } finally {
    store.close();
  }
});

test("concurrent reminder runs atomically claim one delivery", async () => {
  const store = openStore(":memory:"),
    family = openFamilyStore(store.db);
  try {
    const u = family.userFor("telegram", "tg-user", "", "Người thân"),
      target = new Date(2027, 3, 18),
      l = solarToLunar({
        day: target.getDate(),
        month: target.getMonth() + 1,
        year: target.getFullYear(),
      });
    family.createTablet(u.id, {
      honorific: "Bà ngoại",
      fullName: "Nguyễn An",
      birthYear: null,
      deathYear: null,
      day: l.day,
      month: l.month,
      leap: l.leap,
      note: "",
    });
    family.setPrefs(u.id, {
      email: false,
      telegram: true,
      festival: false,
      telegramChat: "123",
      icsHash: null,
    });
    const settings = {
        familyUrl: "https://staging.chuamay.org/family.html",
        lunarLeapRule: "regular-month",
        telegramEnabled: true,
        hashSecret: "x".repeat(64),
      },
      at = new Date(2027, 3, 11);
    let sends = 0;
    const telegram = async () => {
      sends++;
      await new Promise((resolve) => setTimeout(resolve, 30));
    };
    const results = await Promise.all([
      runReminders(settings, family, at, telegram),
      runReminders(settings, family, at, telegram),
    ]);
    assert.equal(sends, 1);
    assert.equal(
      results.reduce((sum, result) => sum + result.sent, 0),
      1,
    );
    assert.equal(
      family.db.prepare("SELECT count(*) n FROM deliveries").get().n,
      1,
    );
  } finally {
    store.close();
  }
});

test("failed reminder is retried at most three times", async () => {
  const store = openStore(":memory:"),
    family = openFamilyStore(store.db);
  try {
    const u = family.userFor("telegram", "tg-fail", "", "Người thân"),
      target = new Date(2027, 3, 18),
      l = solarToLunar({ day: 18, month: 4, year: 2027 });
    family.createTablet(u.id, {
      honorific: "Bà ngoại",
      fullName: "Nguyễn An",
      birthYear: null,
      deathYear: null,
      day: l.day,
      month: l.month,
      leap: l.leap,
      note: "",
    });
    family.setPrefs(u.id, {
      email: false,
      telegram: true,
      festival: false,
      telegramChat: "123",
      icsHash: null,
    });
    const settings = {
      familyUrl: "https://staging.chuamay.org/family.html",
      lunarLeapRule: "regular-month",
      telegramEnabled: true,
      hashSecret: "x".repeat(64),
    };
    let attempts = 0;
    for (let i = 0; i < 4; i++)
      await runReminders(settings, family, new Date(2027, 3, 11), async () => {
        attempts++;
        throw Error("network");
      });
    assert.equal(attempts, 3);
    assert.deepEqual(
      family.db.prepare("SELECT status,attempts FROM deliveries").get(),
      { status: "failed", attempts: 3 },
    );
  } finally {
    store.close();
  }
});
