import fs from "node:fs/promises";
import { equal, hash, validateInitData } from "./security.mjs";

const channels = new Set(["system", "copy", "zalo", "facebook", "messenger", "telegram_forward", "telegram_story", "recommend"]), activities = new Set(["", "incense", "bow", "sit", "mo", "beads", "recommend"]), metrics = new Set(["enter", "share", "activity_complete"]);
const json = (res, status, data = {}) => { res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }); res.end(JSON.stringify(status < 400 ? { ok: true, ...data } : { ok: false, error: data.error || "unavailable" })); };
async function body(req) { const chunks = []; let size = 0; for await (const part of req) { size += part.length; if (size > 4096) throw Error("body"); chunks.push(part); } const value = JSON.parse(Buffer.concat(chunks)); if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("body"); return value; }
const anon = (settings, value) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? hash(settings.hashSecret, `anon:${value.toLowerCase()}`) : "";
const identity = (settings, value) => { if (value.initData) return hash(settings.hashSecret, `telegram:${validateInitData(value.initData, settings.token).id}`); return anon(settings, value.anonymousId); };

async function ops(path) {
  try {
    const raw = JSON.parse(await fs.readFile(path, "utf8"));
    const errors = Array.isArray(raw.errors) ? raw.errors.filter((item) => ["api_5xx", "web_5xx", "backup_failed", "mail_failed"].includes(item?.category) && Number.isInteger(item.count) && typeof item.at === "string").slice(0, 20).map(({ category, count, at }) => ({ category, count, at })) : [];
    return { release: String(raw.release || "").slice(0, 40), api: raw.api === "ok" ? "ok" : "unknown", backupAt: typeof raw.backupAt === "string" ? raw.backupAt : "", backupCheck: raw.backupCheck === "ok" ? "ok" : "unknown", certificateExpires: typeof raw.certificateExpires === "string" ? raw.certificateExpires : "", diskFreeBytes: Number.isSafeInteger(raw.diskFreeBytes) && raw.diskFreeBytes >= 0 ? raw.diskFreeBytes : null, errors };
  } catch { return { release: "", api: "unknown", backupAt: "", backupCheck: "unknown", certificateExpires: "", diskFreeBytes: null, errors: [] }; }
}

export function createMetricsApi(settings, store, access, family = null) {
  return async function handle(req, res, route) {
    if (route.startsWith("/admin/")) {
      if (!settings.adminEnabled || req.method !== "GET" || route !== "/admin/summary") return json(res, 403, { error: "forbidden" }), true;
      try {
        const email = await access.validate(req.headers["cf-access-jwt-assertion"]);
        store.audit(email, "view", "summary");
        const operations = await ops(settings.adminOpsPath); operations.errors = [...store.errors(), ...operations.errors].slice(0, 24);
        return json(res, 200, { data: { ...store.summary(), operations, features: { family: settings.familyEnabled, beadGuruRule: settings.beadGuruRule, guideNoindex: true, mailProvider: settings.mailProvider, telegram: settings.telegramEnabled } } }), true;
      } catch { return json(res, 403, { error: "forbidden" }), true; }
    }
    if (!["/events", "/referrals/identity", "/referrals/bind", "/referrals/me", "/referrals/merge"].includes(route)) return false;
    if (!settings.referralsEnabled) return json(res, 404, { error: "route" }), true;
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers["content-type"] || "")) return json(res, 415, { error: "content_type" }), true;
    let value; try { value = await body(req); } catch { return json(res, 400, { error: "invalid" }), true; }
    try {
      if (route === "/events" && req.method === "POST") {
        if (!metrics.has(value.metric) || (value.metric === "activity_complete" && !activities.has(value.dimension)) || (value.metric !== "activity_complete" && value.dimension)) return json(res, 400, { error: "invalid" }), true;
        store.count(value.metric, value.dimension || ""); return json(res, 201), true;
      }
      if (route === "/referrals/identity" && req.method === "POST") {
        if (value.consent !== true) return json(res, 400, { error: "consent" }), true;
        const id = identity(settings, value); if (!id) return json(res, 400, { error: "identity" }), true;
        return json(res, 200, { code: store.identity(id, value.referralCode) }), true;
      }
      if (route === "/referrals/bind" && req.method === "POST") {
        if (typeof value.referralCode !== "string" || !channels.has(value.channel) || !activities.has(value.activity || "")) return json(res, 400, { error: "invalid" }), true;
        if (value.consent === false) { store.click(value.referralCode); return json(res, 202, { status: "anonymous" }), true; }
        if (value.consent !== true) return json(res, 400, { error: "consent" }), true;
        const id = identity(settings, value); if (!id) return json(res, 400, { error: "identity" }), true;
        store.identity(id, value.ownReferralCode); const status = store.bind(id, value.referralCode, value.channel, value.activity || "");
        return json(res, status === "bound" ? 201 : 200, { status }), true;
      }
      if (route === "/referrals/me" && req.method === "POST") { const id = identity(settings, value); if (!id) return json(res, 400, { error: "identity" }), true; return json(res, 200, { data: store.mine(id) }), true; }
      if (route === "/referrals/me" && req.method === "DELETE") { const id = identity(settings, value); if (!id) return json(res, 400, { error: "identity" }), true; store.remove(id); return json(res, 200), true; }
      if (route === "/referrals/merge" && req.method === "POST") {
        const id = anon(settings, value.anonymousId), raw = (req.headers.cookie || "").split(";").map((item) => item.trim().split("=")).find(([key]) => key === "ct_session")?.[1] || "", session = raw && family?.sessionUser(hash(settings.hashSecret, raw));
        if (!id || !session || !equal(hash(settings.hashSecret, req.headers["x-csrf-token"] || ""), session.csrf_hash)) return json(res, 403, { error: "forbidden" }), true;
        store.merge(id, hash(settings.hashSecret, `account:${session.user_id}`)); return json(res, 200), true;
      }
      res.setHeader("Allow", route === "/referrals/me" ? "POST, DELETE" : "POST"); return json(res, 405, { error: "method" }), true;
    } catch { return json(res, 503, { error: "unavailable" }), true; }
  };
}
