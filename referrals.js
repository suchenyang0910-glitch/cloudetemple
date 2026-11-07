const codePattern = /^[2-9a-hjkmnp-z]{8}$/;
const read = (key) => { try { return localStorage.getItem(key) || ""; } catch { return ""; } };
const write = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
const remove = (key) => { try { localStorage.removeItem(key); } catch {} };
const randomCode = () => { const alphabet = "23456789abcdefghjkmnpqrstuvwxyz", bytes = crypto.getRandomValues(new Uint8Array(8)); return [...bytes].map((value) => alphabet[value % alphabet.length]).join(""); };
const uuid = () => crypto.randomUUID?.() || "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (Number(c) ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> Number(c) / 4).toString(16));

export function createReferrals({ apiURL, telegramData, startParam, landing, enabled = true }) {
  if (!enabled) return { sync: async () => "", link: (channel, activity) => `${location.origin}/?s=${encodeURIComponent(channel)}&a=${encodeURIComponent(activity)}`, telegram: (channel, activity) => `s_${channel}_a_${activity}`.slice(0, 64), enter: async () => null, event() {}, mine: async () => ({ direct: 0, second: 0, channels: [] }), clear: async () => {} };
  const start = startParam(), match = start.match(/^r_([2-9a-hjkmnp-z]{8})_([a-z_]+?)(?:_a_(incense|bow|sit|mo|beads|recommend))?$/);
  const incoming = codePattern.test(landing.referral || "") ? landing.referral : match?.[1] || "";
  const incomingChannel = landing.source || match?.[2] || "recommend", incomingActivity = landing.activity || match?.[3] || "";
  let own = codePattern.test(read("ct-referral-code")) ? read("ct-referral-code") : "", pending;
  const consent = () => read("ct-analytics") === "yes" ? true : read("ct-analytics") === "no" ? false : null;
  const anonymousId = () => { if (telegramData()) return ""; let id = read("ct-referral-id"); if (!/^[0-9a-f-]{36}$/i.test(id)) { id = uuid(); write("ct-referral-id", id); } return id; };
  const request = async (path, data, method = "POST") => { const response = await fetch(apiURL(path), { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), credentials: "include" }); if (!response.ok) throw Error("referral"); return response.json(); };
  const payload = () => ({ anonymousId: anonymousId(), initData: telegramData() });

  async function sync() {
    if (consent() !== true) return "";
    if (pending) return pending;
    if (!own) { own = randomCode(); write("ct-referral-code", own); }
    pending = request("/referrals/identity", { ...payload(), referralCode: own, consent: true }).then((result) => { if (codePattern.test(result.code)) { own = result.code; write("ct-referral-code", own); } return own; }).catch(() => own).finally(() => { pending = null; });
    return pending;
  }

  return {
    sync,
    link(channel, activity) { const params = new URLSearchParams({ s: channel, a: activity }); if (own) params.set("r", own); return `${location.origin}/?${params}`; },
    telegram(channel, activity) { return `${own ? `r_${own}_` : "s_"}${channel}_a_${activity}`.replace(/[^a-z0-9_-]/g, "").slice(0, 64); },
    async enter() { const choice = consent(); if (!incoming || choice == null) return null; if (choice) await sync(); try { const result = await request("/referrals/bind", { ...(choice ? payload() : {}), referralCode: incoming, ownReferralCode: own, channel: incomingChannel, activity: incomingActivity, consent: choice }); return result.status === "bound" ? { status: "bound", channel: incomingChannel, activity: incomingActivity || "recommend" } : null; } catch { return null; } },
    event(metric, dimension = "") { if (consent() === true) void request("/events", { metric, dimension }).catch(() => {}); },
    async mine() { await sync(); return (await request("/referrals/me", payload())).data; },
    async clear() { await request("/referrals/me", payload(), "DELETE"); remove("ct-referral-id"); remove("ct-referral-code"); own = ""; },
  };
}
