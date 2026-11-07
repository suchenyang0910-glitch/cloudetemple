import { randomBytes } from "node:crypto";

const DAY = 86400000, KEEP = 730 * DAY, PRESENCE_TTL = 75000, alphabet = "23456789abcdefghjkmnpqrstuvwxyz";
const code = () => [...randomBytes(8)].slice(0, 8).map((n) => alphabet[n % alphabet.length]).join("");

export function openMetricsStore(db) {
  db.exec(`
CREATE TABLE IF NOT EXISTS daily_counters(day TEXT NOT NULL,metric TEXT NOT NULL,dimension TEXT NOT NULL DEFAULT '',value INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(day,metric,dimension));
CREATE TABLE IF NOT EXISTS system_errors(hour TEXT NOT NULL,category TEXT NOT NULL,value INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(hour,category));
CREATE TABLE IF NOT EXISTS referral_identities(id_hash TEXT PRIMARY KEY,referral_code TEXT NOT NULL UNIQUE,account_hash TEXT,created_at TEXT NOT NULL,expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS referral_bindings(referee_hash TEXT PRIMARY KEY,referrer_hash TEXT NOT NULL,channel TEXT NOT NULL,activity TEXT NOT NULL,first_seen_at TEXT NOT NULL,expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS referral_clicks(referral_code TEXT NOT NULL,day TEXT NOT NULL,value INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(referral_code,day));
CREATE TABLE IF NOT EXISTS referral_limits(referrer_hash TEXT NOT NULL,day TEXT NOT NULL,value INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(referrer_hash,day));
CREATE TABLE IF NOT EXISTS admin_audit(at TEXT NOT NULL,email TEXT NOT NULL,action TEXT NOT NULL,object_type TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS presence_5m(bucket TEXT PRIMARY KEY,peak INTEGER NOT NULL,total INTEGER NOT NULL,samples INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS referral_bindings_referrer ON referral_bindings(referrer_hash);
CREATE INDEX IF NOT EXISTS admin_audit_at ON admin_audit(at);`);
  const one = (sql, ...args) => db.prepare(sql).get(...args), all = (sql, ...args) => db.prepare(sql).all(...args), run = (sql, ...args) => db.prepare(sql).run(...args);
  const day = (time = Date.now()) => new Date(time).toISOString().slice(0, 10);
  const table = (name) => !!one("SELECT 1 ok FROM sqlite_master WHERE type='table' AND name=?", name);
  // shortcut: active sessions are process-local; use a shared registry before running multiple API workers.
  const active = new Map();
  const expirePresence = (at) => { for (const [id, seen] of active) if (seen < at - PRESENCE_TTL) active.delete(id); };

  function identity(idHash, requested = "") {
    const found = one("SELECT referral_code code FROM referral_identities WHERE id_hash=?", idHash);
    if (found) return found.code;
    let next = /^[2-9a-hjkmnp-z]{8}$/.test(requested) ? requested : code();
    for (let attempt = 0; attempt < 8; attempt++) {
      if (!one("SELECT 1 ok FROM referral_identities WHERE referral_code=?", next)) {
        run("INSERT INTO referral_identities VALUES(?,?,?,?,?)", idHash, next, null, new Date().toISOString(), Date.now() + KEEP);
        return next;
      }
      next = code();
    }
    throw Error("referral_code");
  }

  const bind = db.transaction((refereeHash, referralCode, channel, activity, at = Date.now()) => {
    const referrer = one("SELECT id_hash,account_hash FROM referral_identities WHERE referral_code=?", referralCode), referee = one("SELECT account_hash FROM referral_identities WHERE id_hash=?", refereeHash);
    if (!referrer || referrer.id_hash === refereeHash || (referrer.account_hash && referrer.account_hash === referee?.account_hash)) return "ignored";
    if (one("SELECT 1 ok FROM referral_bindings WHERE referee_hash=?", refereeHash)) return "existing";
    const today = day(at), count = one("SELECT value FROM referral_limits WHERE referrer_hash=? AND day=?", referrer.id_hash, today)?.value || 0;
    if (count >= 200) return "limited";
    run("INSERT INTO referral_bindings VALUES(?,?,?,?,?,?)", refereeHash, referrer.id_hash, channel, activity, new Date(at).toISOString(), at + KEEP);
    run("INSERT INTO referral_limits VALUES(?,?,1) ON CONFLICT(referrer_hash,day) DO UPDATE SET value=value+1", referrer.id_hash, today);
    return "bound";
  });

  function suppress(rows, subject = "subjects") {
    return rows.map((row) => Number(row[subject]) < 5 ? { key: row.key, status: "insufficient" } : { key: row.key, value: Number(row.value), subjects: Number(row[subject]) });
  }

  function summary() {
    const counters = all("SELECT day,metric,dimension,value FROM daily_counters WHERE day>=date('now','-29 day') ORDER BY day,metric,dimension");
    const identities = one("SELECT count(*) n FROM referral_identities").n, bindings = one("SELECT count(*) n FROM referral_bindings").n;
    const channels = suppress(all("SELECT channel key,count(*) value,count(DISTINCT referee_hash) subjects FROM referral_bindings GROUP BY channel"));
    const activities = suppress(all("SELECT activity key,count(*) value,count(DISTINCT referee_hash) subjects FROM referral_bindings GROUP BY activity"));
    const treeRows = identities < 5 ? [] : all("SELECT referrer_hash,referee_hash FROM referral_bindings ORDER BY first_seen_at LIMIT 500");
    const labels = new Map(), label = (hash) => { if (!labels.has(hash)) labels.set(hash, `A-${String(labels.size + 1).padStart(3, "0")}`); return labels.get(hash); };
    const family = table("tablets") ? {
      tablets: one("SELECT count(*) n FROM tablets").n,
      members: one("SELECT count(*) n FROM tablet_members").n,
      invites: one("SELECT count(*) n FROM invites").n,
      accepted: one("SELECT COALESCE(sum(uses),0) n FROM invites").n,
    } : { tablets: 0, members: 0, invites: 0, accepted: 0 };
    const reminderCohort = table("deliveries") ? one("SELECT count(DISTINCT user_id) n FROM deliveries WHERE status='sent' AND sent_at>=datetime('now','-30 day')").n : 0;
    const reminderReturns = reminderCohort ? one("SELECT count(DISTINCT d.user_id) n FROM deliveries d WHERE d.status='sent' AND d.sent_at>=datetime('now','-30 day') AND EXISTS(SELECT 1 FROM offerings o WHERE o.user_id=d.user_id AND o.tablet_id=d.tablet_id AND o.kind='incense' AND o.at>=d.sent_at AND o.at<datetime(d.sent_at,'+3 day'))").n : 0;
    const deliveries = table("deliveries") ? all("SELECT status key,channel,count(*) value,count(DISTINCT user_id) subjects FROM deliveries WHERE created_at>=datetime('now','-7 day') GROUP BY status,channel") : [];
    const presence = all("SELECT substr(bucket,1,13)||':00:00.000Z' key,max(peak) peak,round(sum(total)*1.0/sum(samples),1) average,sum(samples) samples FROM presence_5m WHERE bucket>=strftime('%Y-%m-%dT%H:%M:00.000Z','now','-30 day') GROUP BY substr(bucket,1,13) ORDER BY key")
      .map((row) => Number(row.peak) < 5 ? { key: row.key, status: "insufficient" } : { key: row.key, peak: Number(row.peak), average: Number(row.average), samples: Number(row.samples) });
    return {
      overview: { counters },
      presence: { hours: presence },
      referrals: { identities, bindings, k: identities >= 5 ? Number((bindings / identities).toFixed(2)) : null, channels, activities, tree: identities < 5 ? { status: "insufficient", nodes: [], edges: [] } : { status: "ok", nodes: [...labels.values()].map((id) => ({ id })), edges: treeRows.map((row) => ({ from: label(row.referrer_hash), to: label(row.referee_hash) })) } },
      family: { ...family, averageMembers: family.tablets >= 5 ? Number((family.members / family.tablets).toFixed(2)) : null, inviteAcceptance: family.invites >= 5 ? Number((family.accepted / family.invites).toFixed(3)) : null, reminderReturn: reminderCohort >= 5 ? Number((reminderReturns / reminderCohort).toFixed(3)) : null },
      deliveries: suppress(deliveries),
    };
  }

  return {
    identity,
    bind: (...args) => bind.immediate(...args),
    click(referralCode, at = Date.now()) { if (!one("SELECT 1 ok FROM referral_identities WHERE referral_code=?", referralCode)) return false; run("INSERT INTO referral_clicks VALUES(?,?,1) ON CONFLICT(referral_code,day) DO UPDATE SET value=value+1", referralCode, day(at)); return true; },
    count(metric, dimension = "", at = Date.now()) { run("INSERT INTO daily_counters VALUES(?,?,?,1) ON CONFLICT(day,metric,dimension) DO UPDATE SET value=value+1", day(at), metric, dimension); },
    heartbeat(id, at = Date.now()) { expirePresence(at); if (!active.has(id) && active.size >= 10000) return false; active.set(id, at); return true; },
    samplePresence(at = Date.now()) { expirePresence(at); const value = active.size, bucket = new Date(Math.floor(at / 300000) * 300000).toISOString(); run("INSERT INTO presence_5m VALUES(?,?,?,1) ON CONFLICT(bucket) DO UPDATE SET peak=max(peak,excluded.peak),total=total+excluded.total,samples=samples+1", bucket, value, value); return value; },
    error(category = "api_5xx", at = Date.now()) { const hour = new Date(at).toISOString().slice(0, 13) + ":00:00.000Z"; run("INSERT INTO system_errors VALUES(?,?,1) ON CONFLICT(hour,category) DO UPDATE SET value=value+1", hour, category); },
    errors() { return all("SELECT category,value count,hour at FROM system_errors WHERE hour>=strftime('%Y-%m-%dT%H:00:00.000Z','now','-24 hours') ORDER BY hour DESC LIMIT 24"); },
    mine(idHash) { const me = one("SELECT referral_code code FROM referral_identities WHERE id_hash=?", idHash); if (!me) return { direct: 0, second: 0, channels: [] }; const direct = one("SELECT count(*) n FROM referral_bindings WHERE referrer_hash=?", idHash).n, second = one("SELECT count(DISTINCT b2.referee_hash) n FROM referral_bindings b1 JOIN referral_bindings b2 ON b2.referrer_hash=b1.referee_hash WHERE b1.referrer_hash=?", idHash).n; return { direct, second, channels: suppress(all("SELECT channel key,count(*) value,count(DISTINCT referee_hash) subjects FROM referral_bindings WHERE referrer_hash=? GROUP BY channel", idHash)) }; },
    merge(idHash, accountHash) { run("UPDATE referral_identities SET account_hash=? WHERE id_hash=?", accountHash, idHash); run("DELETE FROM referral_bindings WHERE referee_hash IN(SELECT id_hash FROM referral_identities WHERE account_hash=?) AND referrer_hash IN(SELECT id_hash FROM referral_identities WHERE account_hash=?)", accountHash, accountHash); },
    remove(idHash) { db.transaction(() => { run("DELETE FROM referral_bindings WHERE referee_hash=? OR referrer_hash=?", idHash, idHash); run("DELETE FROM referral_identities WHERE id_hash=?", idHash); })(); },
    audit(email, action, objectType) { run("INSERT INTO admin_audit VALUES(?,?,?,?)", new Date().toISOString(), email, action, objectType); },
    summary,
    cleanup() { const cutoff = Date.now(); run("DELETE FROM referral_bindings WHERE expires_at<=?", cutoff); run("DELETE FROM referral_identities WHERE expires_at<=?", cutoff); run("DELETE FROM referral_limits WHERE day<date('now','-2 day')"); run("DELETE FROM admin_audit WHERE at<datetime('now','-365 day')"); run("DELETE FROM system_errors WHERE hour<strftime('%Y-%m-%dT%H:00:00.000Z','now','-2 day')"); run("DELETE FROM presence_5m WHERE bucket<strftime('%Y-%m-%dT%H:%M:00.000Z','now','-31 day')"); },
  };
}
