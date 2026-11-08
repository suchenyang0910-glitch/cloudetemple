import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./security.mjs";
import { openStore } from "./store.mjs";
import { openFamilyStore } from "./family-store.mjs";
import { sendMail } from "./mail.mjs";

const GIB = 1073741824;
const vnDay = (date) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

export async function collectDailyOps(settings, db, now = new Date(), fetcher = fetch, readOps = () => fs.readFile(settings.adminOpsPath, "utf8").then(JSON.parse)) {
  const today = vnDay(now), yesterday = vnDay(new Date(Date.parse(`${today}T00:00:00+07:00`) - 86400000)), start = new Date(`${yesterday}T00:00:00+07:00`).toISOString(), end = new Date(`${today}T00:00:00+07:00`).toISOString();
  const deliveries = db.prepare("SELECT count(*) expected,sum(status='sent') sent,sum(status='failed') failed FROM deliveries WHERE created_at>=? AND created_at<?").get(start, end), apiErrors = db.prepare("SELECT COALESCE(sum(value),0) n FROM system_errors WHERE hour>=? AND hour<? AND category='api_5xx'").get(start, end).n;
  let operations = {}, bounces = null;
  try { operations = await readOps(); } catch {}
  if (settings.mailProvider === "resend" && settings.resendKey) {
    try {
      const url = new URL("https://api.resend.com/emails/metrics");
      url.search = new URLSearchParams({ start_date: yesterday, end_date: today, timezone: "Asia/Ho_Chi_Minh", metrics: "bounced" });
      const response = await fetcher(url, { headers: { Authorization: `Bearer ${settings.resendKey}`, Accept: "application/json" }, signal: AbortSignal.timeout(10000) });
      const value = response.ok ? await response.json() : null;
      if (Number.isSafeInteger(value?.totals?.bounced) && value.totals.bounced >= 0) bounces = value.totals.bounced;
    } catch {}
  }
  const externalErrors = Array.isArray(operations.errors) ? operations.errors.filter((item) => ["web_5xx", "backup_failed", "mail_failed"].includes(item?.category)).reduce((total, item) => total + (Number.isSafeInteger(item.count) && item.count > 0 ? item.count : 0), 0) : 0;
  const snapshot = { day: yesterday, expected: Number(deliveries.expected || 0), sent: Number(deliveries.sent || 0), failed: Number(deliveries.failed || 0), bounces, errors: Number(apiErrors) + externalErrors, checkedAt: now.toISOString() };
  const reasons = [];
  if (snapshot.sent + snapshot.failed !== snapshot.expected) reasons.push("提醒投递数量不一致");
  if (snapshot.failed) reasons.push(`提醒失败 ${snapshot.failed}`);
  if (snapshot.bounces === null) reasons.push("退信指标不可用"); else if (snapshot.bounces) reasons.push(`邮件退信 ${snapshot.bounces}`);
  if (snapshot.errors) reasons.push(`5xx 或运维错误 ${snapshot.errors}`);
  if (operations.backupCheck !== "ok") reasons.push("最近备份状态异常");
  if (!Number.isSafeInteger(operations.diskFreeBytes) || operations.diskFreeBytes < 2 * GIB) reasons.push("磁盘余量不足或未知");
  return { snapshot, reasons };
}

async function writeSnapshot(file, value) {
  const temp = `${file}.${process.pid}.tmp`;
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(temp, JSON.stringify(value), { mode: 0o600 });
  await fs.rename(temp, file);
}

async function run() {
  const settings = config(process.env);
  if (settings.environment !== "staging" || !settings.adminEnabled || !settings.opsAlertEmail) throw Error("daily ops is staging-only and requires OPS_ALERT_EMAIL");
  const store = openStore(settings.db), family = openFamilyStore(store.db, { demo: false });
  try {
    const { snapshot, reasons } = await collectDailyOps(settings, store.db);
    await writeSnapshot(settings.dailyOpsPath, snapshot);
    if (reasons.length) {
      const marker = path.join(path.dirname(settings.dailyOpsPath), `ops-alert-${snapshot.day}`);
      try { await fs.access(marker); return; } catch {}
      const lines = [`日期：${snapshot.day}`, ...reasons];
      await sendMail(settings, family, { to: settings.opsAlertEmail, subject: `[Chùa Mây staging] 每日运维异常 ${snapshot.day}`, text: lines.join("\n"), html: `<p>${lines.join("<br>")}</p>` });
      await fs.writeFile(marker, snapshot.checkedAt, { mode: 0o600 });
    }
  } finally { store.close(); }
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll("\\", "/")}`) await run();
