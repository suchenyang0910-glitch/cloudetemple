import test from "node:test";
import assert from "node:assert/strict";
import { openStore } from "./store.mjs";
import { openFamilyStore } from "./family-store.mjs";
import { runReminders } from "./reminders.mjs";
import { solarToLunar } from "./lunar-hnd.mjs";
import { listOutbox } from "./outbox-staging.mjs";
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
    assert.match(outbox[0].text_body, /Tắt nhắc nhở:/);
    assert.doesNotMatch(outbox[0].text_body, /demo@example\.com/);
  } finally {
    store.close();
  }
});
