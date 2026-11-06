import { config, hash } from "./security.mjs";
import { openStore } from "./store.mjs";
import { openFamilyStore } from "./family-store.mjs";
import {
  anniversary,
  solarToLunar,
  isoDate,
  qingmingDate,
} from "./lunar-hnd.mjs";
import { sendMail } from "./mail.mjs";
import { escapeFamilyHTML, familyServerText } from "./family-i18n.mjs";
const plus = (date, days) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const solar = (d) => ({
  day: d.getDate(),
  month: d.getMonth() + 1,
  year: d.getFullYear(),
});
export async function runReminders(
  settings,
  family,
  at = new Date(),
  telegram = async (chat, text) => {
    const r = await fetch(
      `https://api.telegram.org/bot${settings.token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chat, text }),
      },
    );
    if (!r.ok) throw Error("telegram");
  },
) {
  const db = family.db,
    users = db
      .prepare(
        `SELECT DISTINCT u.id,p.email_on,p.telegram_on,p.telegram_chat_id,p.festival_on,i.email FROM users u JOIN tablet_members m ON m.user_id=u.id JOIN reminder_prefs p ON p.user_id=u.id LEFT JOIN identities i ON i.user_id=u.id AND i.provider='email' WHERE u.deleted_at IS NULL`,
      )
      .all(),
    tablets = db.prepare(
      "SELECT t.* FROM tablets t JOIN tablet_members m ON m.tablet_id=t.id WHERE m.user_id=?",
    ),
    claim = db.prepare(
      `INSERT INTO deliveries(id,user_id,tablet_id,kind,due_date,channel,sent_at,status,attempts,created_at,dedupe_key,demo)
       VALUES(?,?,?,?,?,?,NULL,'sending',1,?,?,1)
       ON CONFLICT(dedupe_key) DO UPDATE SET status='sending',sent_at=NULL,attempts=deliveries.attempts+1,created_at=excluded.created_at
       WHERE (deliveries.status='failed' AND deliveries.attempts<3)
          OR (deliveries.status='sending' AND deliveries.attempts<3 AND deliveries.created_at<?)
       RETURNING id`,
    ),
    finish = db.prepare(
      "UPDATE deliveries SET sent_at=?,status=? WHERE id=? AND status='sending'",
    );
  let sent = 0,
    failed = 0;
  const unsubscribeURL = (userId) => {
    const signature = hash(settings.hashSecret, `unsubscribe:${userId}`).slice(
        0,
        32,
      ),
      base = settings.familyUrl.replace(/\/family\.html$/, "");
    return `${base}/api/family/reminders/unsubscribe?token=${encodeURIComponent(`${userId}.${signature}`)}`;
  };
  const deliver = async (user, tablet, kind, due, channel, text) => {
    const now = new Date(),
      key = [user.id, tablet?.id || "festival", kind, due, channel].join("|"),
      delivery = claim.get(
        crypto.randomUUID(),
        user.id,
        tablet?.id || null,
        kind,
        due,
        channel,
        now.toISOString(),
        key,
        new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
      );
    if (!delivery) return;
    let status = "sent";
    try {
      if (channel === "email") {
        const unsubscribe = unsubscribeURL(user.id);
        await sendMail(settings, family, {
          to: user.email,
          subject: familyServerText("reminder_subject"),
          text: `${text}\n\n${familyServerText("reminder_open")}: ${settings.familyUrl}\n${familyServerText("reminder_unsubscribe")}: ${unsubscribe}`,
          html: `<p>${escapeFamilyHTML(text)}</p><p><a href="${settings.familyUrl}">${escapeFamilyHTML(familyServerText("reminder_open"))}</a></p><p><a href="${unsubscribe}">${escapeFamilyHTML(familyServerText("reminder_unsubscribe_email"))}</a></p>`,
        });
      } else await telegram(user.telegram_chat_id, text);
      sent++;
    } catch {
      status = "failed";
      failed++;
    }
    finish.run(
      status === "sent" ? new Date().toISOString() : null,
      status,
      delivery.id,
    );
  };
  for (const user of users) {
    const channels = [
      ...(user.email_on && user.email ? ["email"] : []),
      ...(settings.telegramEnabled && user.telegram_on && user.telegram_chat_id
        ? ["telegram"]
        : []),
    ];
    for (const days of [7, 1]) {
      const target = plus(at, days),
        due = isoDate(solar(target));
      for (const tablet of tablets.all(user.id)) {
        const a = anniversary(
          {
            day: tablet.death_lunar_day,
            month: tablet.death_lunar_month,
            leap: !!tablet.death_lunar_leap,
          },
          target.getFullYear(),
          settings.lunarLeapRule,
        );
        if (isoDate(a) !== due) continue;
        const text = familyServerText("anniversary_reminder", {
          days,
          honorific: tablet.honorific,
        });
        for (const ch of channels)
          await deliver(user, tablet, `anniversary_${days}`, due, ch, text);
      }
    }
    if (user.festival_on) {
      const target = plus(at, 1),
        l = solarToLunar(solar(target)),
        qingming =
          isoDate(solar(target)) ===
          isoDate(qingmingDate(target.getFullYear())),
        name = qingming
          ? familyServerText("festival_qingming")
          : l.day === 1 && l.month === 1
            ? familyServerText("festival_tet")
            : l.day === 15 && l.month === 7
              ? familyServerText("festival_vu_lan")
              : l.day === 23 && l.month === 12
                ? familyServerText("festival_kitchen_gods")
                : l.day === 1
                  ? familyServerText("festival_new_moon")
                  : l.day === 15
                    ? familyServerText("festival_full_moon")
                    : null;
      if (name) {
        const due = isoDate(solar(target)),
          text = familyServerText("festival_reminder", { festival: name });
        for (const ch of channels)
          await deliver(user, null, "festival", due, ch, text);
      }
    }
  }
  return { sent, failed };
}
if (import.meta.url === `file://${process.argv[1]?.replaceAll("\\", "/")}`) {
  const settings = config(process.env),
    store = openStore(settings.db),
    family = openFamilyStore(store.db);
  try {
    const result = await runReminders(settings, family);
    console.log(JSON.stringify(result));
  } finally {
    store.close();
  }
}
