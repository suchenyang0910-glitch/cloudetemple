import {
  randomBytes,
  randomInt,
  createHash,
  timingSafeEqual,
} from "node:crypto";
import { hash, clientIP, validateInitData } from "./security.mjs";
import {
  lunarToSolar,
  solarToLunar,
  anniversary,
  isoDate,
  qingmingDate,
} from "./lunar-hnd.mjs";
import { sendMail } from "./mail.mjs";
import { createFamilyCalendarPdf } from "./calendar-pdf.mjs";
import {
  escapeFamilyHTML,
  familyServerLanguage,
  familyServerText,
} from "./family-i18n.mjs";
const json = (res, status, data, headers = {}) => {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  res.end(JSON.stringify(data));
};
const token = (bytes = 32) => randomBytes(bytes).toString("base64url");
const cookies = (req) =>
  Object.fromEntries(
    (req.headers.cookie || "")
      .split(";")
      .map((v) => v.trim().split(/=(.*)/s))
      .filter((x) => x[0]),
  );
const ua = (req) =>
  (req.headers["user-agent"] || "").replace(/[\r\n]/g, "").slice(0, 160);
const embedded = (req) =>
  /Telegram|FBAN|FBAV|Zalo|Instagram|Messenger/i.test(ua(req));
async function body(req, max = 32768) {
  const chunks = [];
  let n = 0;
  for await (const p of req) {
    n += p.length;
    if (n > max) throw Error("body");
    chunks.push(p);
  }
  try {
    return JSON.parse(Buffer.concat(chunks));
  } catch {
    throw Error("body");
  }
}
const validEmail = (v) =>
  typeof v === "string" &&
  v.length <= 254 &&
  /^[^\s@<>]+@[^\s@<>.]+(?:\.[^\s@<>.]+)+$/.test(v);
const CONSENT_VERSION = "pilot-2026-11-07-v2";
const forbiddenPresale = /công đức|hòm công đức|功德箱|积功德|消灾|保佑|祈福有效|功德圆满/iu;
const text = (value, max, required = true) => {
  const result = String(value || "").normalize("NFC").trim();
  if ((required && !result) || result.length > max || /[\u0000-\u001f]/u.test(result) || forbiddenPresale.test(result)) throw Error("invalid");
  return result;
};
function interestInput(value) {
  const ancestorCount = String(value?.ancestorCount || ""), willingness = String(value?.willingness || "");
  if (value?.agree !== true || !["1-2", "3-5", "6-10", "10+"].includes(ancestorCount) || !["under-50", "50-99", "100+", "none"].includes(willingness)) throw Error("invalid");
  return { name: text(value?.name, 80, false), contact: text(value?.contact, 100), ancestorCount, willingness, region: text(value?.region, 40, false) };
}
function preorderInput(value) {
  const anniversaries = Array.isArray(value?.anniversaries) ? value.anniversaries.slice(0, 10).map((item) => ({ name: text(item?.name, 100), date: text(item?.date, 40) })) : [];
  if (Object.hasOwn(value ?? {}, "address") || value?.agree !== true || !anniversaries.length || !["basic", "family"].includes(value?.edition)) throw Error("invalid");
  return { contact: text(value.contact, 100), familyName: text(value.familyName, 100), edition: value.edition, anniversaries };
}
const validSolarDate = ({ day, month, year }) => {
  if (![day, month, year].every(Number.isInteger) || year < 1900 || year > 2100)
    return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
};
function tabletInput(v) {
  const honorific = String(v?.honorific || "")
      .normalize("NFC")
      .trim(),
    fullName = String(v?.fullName || "")
      .normalize("NFC")
      .trim(),
    note = String(v?.note || "")
      .normalize("NFC")
      .trim();
  const birthYear = v?.birthYear == null ? null : Number(v.birthYear),
    deathYear = v?.deathYear == null ? null : Number(v.deathYear),
    day = Number(v?.day),
    month = Number(v?.month);
  if (
    !honorific ||
    honorific.length > 40 ||
    !fullName ||
    fullName.length > 100 ||
    note.length > 200 ||
    /[\u0000-\u001f]/u.test(honorific + fullName + note) ||
    !Number.isInteger(day) ||
    day < 1 ||
    day > 30 ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  )
    throw Error("invalid");
  for (const y of [birthYear, deathYear])
    if (
      y !== null &&
      (!Number.isInteger(y) || y < 1000 || y > new Date().getFullYear())
    )
      throw Error("invalid");
  if (deathYear === null && (day === 30 || v?.leap === true))
    throw Error("death_year_required");
  if (deathYear !== null) {
    let solar;
    try {
      solar = lunarToSolar({
        day,
        month,
        year: deathYear,
        leap: v?.leap === true,
      });
    } catch {
      throw Error("invalid_date");
    }
    const roundTrip = solarToLunar(solar);
    if (
      roundTrip.day !== day ||
      roundTrip.month !== month ||
      roundTrip.year !== deathYear ||
      roundTrip.leap !== (v?.leap === true)
    )
      throw Error("invalid_date");
  }
  return {
    honorific,
    fullName,
    note,
    birthYear,
    deathYear,
    day,
    month,
    leap: v?.leap === true,
  };
}
export function createFamilyApi(settings, family, dependencies = {}) {
  const calendarPdf = dependencies.calendarPdf || createFamilyCalendarPdf;
  const metric = dependencies.metric || (() => {});
  const allowed = (email) => settings.familyAllowlist.has(String(email || "").trim().toLowerCase());
  const cookieDomain =
    settings.environment === "production" ? "; Domain=.chuamay.org" : "";
  const oauthRedirect = (res, reason) => {
    res.writeHead(302, {
      Location: `${settings.familyUrl}?auth=${encodeURIComponent(reason)}`,
      "Cache-Control": "no-store",
    });
    res.end();
    return true;
  };
  const unsubscribeToken = (userId) =>
    `${userId}.${hash(settings.hashSecret, `unsubscribe:${userId}`).slice(0, 32)}`;
  const validUnsubscribe = (raw) => {
    const [userId, signature, extra] = String(raw || "").split(".");
    if (
      extra ||
      !/^[0-9a-f-]{36}$/i.test(userId || "") ||
      !/^[0-9a-f]{32}$/i.test(signature || "")
    )
      return null;
    const expected = unsubscribeToken(userId).split(".")[1];
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
      ? userId
      : null;
  };
  const session = (req) => {
    const raw = cookies(req).ct_session;
    if (!raw) return null;
    const tokenHash = hash(settings.hashSecret, raw),
      found = family.sessionUser(tokenHash);
    return found ? { ...found, tokenHash } : null;
  };
  const csrf = (req, user) =>
    user &&
    typeof req.headers["x-csrf-token"] === "string" &&
    hash(settings.hashSecret, req.headers["x-csrf-token"]) === user.csrf_hash;
  const issue = (res, user) => {
    const raw = token(),
      anti = token(18),
      max = 30 * 86400;
    family.session(
      hash(settings.hashSecret, raw),
      user.id,
      Date.now() + max * 1000,
      hash(settings.hashSecret, anti),
    );
    res.setHeader(
      "Set-Cookie",
      `ct_session=${raw}; Path=/; Max-Age=${max}; HttpOnly; Secure; SameSite=Lax${cookieDomain}`,
    );
    return anti;
  };
  return async function handle(req, res, route) {
    if (!(route.startsWith("/family/") || route.startsWith("/auth/google/")))
      return false;
    try {
      const language = familyServerLanguage(req),
        user = session(req),
        write = !["GET", "HEAD"].includes(req.method);
      if (user && !allowed(user.email))
        return json(res, 404, { ok: false, error: "not_found" }), true;
      if (write) {
        const origin = req.headers.origin;
        if (!origin || !settings.origins?.has(origin))
          return json(res, 403, { ok: false, error: "origin" }), true;
        if (
          String(req.headers["content-type"] || "")
            .split(";", 1)[0]
            .trim()
            .toLowerCase() !== "application/json"
        )
          return json(res, 415, { ok: false, error: "content_type" }), true;
      }
      if (write && user && !csrf(req, user))
        return json(res, 403, { ok: false, error: "csrf" }), true;
      if (settings.environment === "staging") {
        const { handleOutbox } = await import("./outbox-staging.mjs");
        if (handleOutbox(req, res, route, family.db)) return true;
      }
      if (route === "/family/status" && req.method === "GET")
        return user
          ? (json(res, 200, { ok: true, enabled: true }), true)
          : (json(res, 404, { ok: false, error: "not_found" }), true);
      if (route === "/family/auth/email/start" && req.method === "POST") {
        const v = await body(req),
          email = String(v.email || "")
            .trim()
            .toLowerCase();
        if (!validEmail(email))
          return json(res, 400, { ok: false, error: "invalid" }), true;
        if (!allowed(email))
          return json(res, 404, { ok: false, error: "not_found" }), true;
        const subject = hash(settings.hashSecret, email),
          ip = hash(settings.hashSecret, clientIP(req, settings.trustLocal));
        if (
          !family.rate("email:" + subject, Date.now() + 60000) ||
          !family.rate("ip:" + ip, Date.now() + 30000)
        )
          return json(res, 429, { ok: false, error: "rate_limit" }), true;
        const code = String(randomInt(100000, 1000000));
        family.saveCode({
          subject,
          email,
          codeHash: hash(settings.hashSecret, code),
          expires: Date.now() + 600000,
          ipHash: ip,
        });
        await sendMail(settings, family, {
          to: email,
          subject: familyServerText("otp_subject", {}, language),
          text: familyServerText("otp_text", { code }, language),
          html: familyServerText("otp_html", { code }, language),
        });
        return json(res, 201, { ok: true }), true;
      }
      if (route === "/family/auth/email/verify" && req.method === "POST") {
        const v = await body(req),
          email = String(v.email || "")
            .trim()
            .toLowerCase(),
          code = String(v.code || "");
        if (!validEmail(email) || !/^\d{6}$/.test(code))
          return json(res, 400, { ok: false, error: "invalid" }), true;
        if (!allowed(email))
          return json(res, 404, { ok: false, error: "not_found" }), true;
        const subject = hash(settings.hashSecret, email),
          record = family.takeCode(subject, hash(settings.hashSecret, code));
        if (!record) return json(res, 401, { ok: false, error: "code" }), true;
        const account = family.userFor(
            "email",
            subject,
            email,
            familyServerText("relative_default", {}, language),
          ),
          anti = issue(res, account);
        return (
          json(res, 200, {
            ok: true,
            csrf: anti,
            user: { displayName: account.display_name },
            tablets: family.listTablets(account.id),
          }),
          true
        );
      }
      if (route === "/family/auth/telegram" && req.method === "POST") {
        if (settings.familyAllowlist.size)
          return json(res, 404, { ok: false, error: "not_found" }), true;
        if (!settings.telegramEnabled)
          return (
            json(res, 503, { ok: false, error: "telegram_disabled" }), true
          );
        const v = await body(req);
        let tg;
        try {
          tg = validateInitData(v.initData, settings.token);
        } catch {
          return json(res, 401, { ok: false, error: "init_data" }), true;
        }
        const account = family.userFor(
            "telegram",
            hash(settings.hashSecret, tg.id),
            "",
            "Telegram",
          ),
          anti = issue(res, account);
        family.setPrefs(account.id, {
          ...family.prefs(account.id),
          telegramChat: tg.id,
          telegram: false,
          email: false,
          festival: true,
        });
        return json(res, 200, { ok: true, csrf: anti }), true;
      }
      if (route === "/auth/google/start" && req.method === "GET") {
        if (embedded(req))
          return json(res, 400, { ok: false, error: "embedded_browser" }), true;
        if (!settings.googleId || !settings.googleSecret)
          return oauthRedirect(res, "google_unavailable");
        const state = token(24),
          verifier = token(48),
          challenge = createHash("sha256").update(verifier).digest("base64url");
        family.saveState(
          hash(settings.hashSecret, state),
          verifier,
          Date.now() + 600000,
        );
        res.setHeader(
          "Set-Cookie",
          `ct_oauth=${state}; Path=/auth/google/callback; Max-Age=600; HttpOnly; Secure; SameSite=Lax`,
        );
        const q = new URLSearchParams({
          client_id: settings.googleId,
          redirect_uri: settings.googleRedirect,
          response_type: "code",
          scope: "openid email profile",
          state,
          code_challenge: challenge,
          code_challenge_method: "S256",
          prompt: "select_account",
        });
        res.writeHead(302, {
          Location: `https://accounts.google.com/o/oauth2/v2/auth?${q}`,
          "Cache-Control": "no-store",
        });
        res.end();
        return true;
      }
      if (route === "/auth/google/callback" && req.method === "GET") {
        const url = new URL(req.url, "http://localhost"),
          state = url.searchParams.get("state"),
          code = url.searchParams.get("code"),
          saved = state && family.takeState(hash(settings.hashSecret, state));
        if (!saved || cookies(req).ct_oauth !== state || !code)
          return oauthRedirect(res, "google_failed");
        const tr = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: settings.googleId,
            client_secret: settings.googleSecret,
            redirect_uri: settings.googleRedirect,
            grant_type: "authorization_code",
            code,
            code_verifier: saved.verifier,
          }),
        });
        if (!tr.ok) return oauthRedirect(res, "google_failed");
        const td = await tr.json();
        const ur = await fetch(
          "https://openidconnect.googleapis.com/v1/userinfo",
          { headers: { Authorization: `Bearer ${td.access_token}` } },
        );
        if (!ur.ok) return oauthRedirect(res, "google_failed");
        const profile = await ur.json(),
          email = String(profile.email || "").trim().toLowerCase();
        if (profile.email_verified !== true || !profile.sub || !validEmail(email))
          return oauthRedirect(res, "google_failed");
        if (!allowed(email)) return oauthRedirect(res, "not_found");
        const account = family.userFor(
          "google",
          hash(settings.hashSecret, String(profile.sub)),
          email,
          String(profile.name || "").slice(0, 60),
        );
        issue(res, account);
        res.writeHead(302, {
          Location: settings.familyUrl,
          "Cache-Control": "no-store",
        });
        res.end();
        return true;
      }
      if (route === "/family/session" && req.method === "GET") {
        if (!user)
          return json(res, 404, { ok: false, error: "not_found" }), true;
        let anti = null;
        if (user) {
          anti = token(18);
          family.rotateCsrf(user.tokenHash, hash(settings.hashSecret, anti));
        }
        return (
          json(res, 200, {
            ok: true,
            authenticated: !!user,
            csrf: anti,
            user: user
              ? { displayName: user.display_name, locale: user.locale }
              : null,
          }),
          true
        );
      }
      if (route === "/family/logout" && req.method === "POST") {
        if (user) family.logout(user.tokenHash);
        res.setHeader(
          "Set-Cookie",
          `ct_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax${cookieDomain}`,
        );
        return json(res, 200, { ok: true }), true;
      }
      if (route === "/family/invites/info" && req.method === "POST") {
        if (!user)
          return json(res, 404, { ok: false, error: "not_found" }), true;
        const v = await body(req),
          i = family.inviteInfo(
            hash(settings.hashSecret, String(v.token || "")),
          );
        if (
          !i ||
          i.revoked_at ||
          i.expires_at < Date.now() ||
          i.uses >= i.max_uses
        )
          return json(res, 404, { ok: false, error: "invite" }), true;
        return (
          json(res, 200, {
            ok: true,
            invite: {
              honorific: i.honorific,
              fullName: i.full_name,
              inviter: i.inviter,
            },
          }),
          true
        );
      }
      if (route === "/family/calendar.ics" && req.method === "GET") {
        const raw =
            new URL(req.url, "http://localhost").searchParams.get("token") ||
            "",
          entry = family.calendarUser(hash(settings.hashSecret, raw));
        if (!entry)
          return json(res, 404, { ok: false, error: "calendar" }), true;
        const year = new Date().getFullYear(),
          lines = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//Chua May//Family Memorial//VI",
            "CALSCALE:GREGORIAN",
          ];
        for (const tablet of entry.tablets)
          for (let y = year; y < year + 3; y++) {
            const d = anniversary(
                {
                  day: tablet.death_lunar_day,
                  month: tablet.death_lunar_month,
                  leap: !!tablet.death_lunar_leap,
                },
                y,
                settings.lunarLeapRule,
              ),
              date = isoDate(d).replaceAll("-", "");
            lines.push(
              "BEGIN:VEVENT",
              `UID:${tablet.id}-${y}@chuamay.org`,
              `DTSTART;VALUE=DATE:${date}`,
              `SUMMARY:${familyServerText("calendar_anniversary", { honorific: tablet.honorific }).replace(/[\\;,\n]/g, " ")}`,
              "END:VEVENT",
            );
          }
        if (entry.prefs.festival_on) {
          for (let y = year; y < year + 3; y++) {
            const festivals = [];
            for (let month = 1; month <= 12; month++) {
              festivals.push({
                date: lunarToSolar({ day: 1, month, year: y }),
                key: `newmoon-${month}`,
                title: familyServerText(
                  month === 1 ? "festival_tet" : "festival_new_moon",
                ),
              });
              festivals.push({
                date: lunarToSolar({ day: 15, month, year: y }),
                key: `fullmoon-${month}`,
                title: familyServerText(
                  month === 7 ? "festival_vu_lan" : "festival_full_moon",
                ),
              });
            }
            festivals.push(
              {
                date: lunarToSolar({ day: 23, month: 12, year: y }),
                key: "ong-cong-ong-tao",
                title: familyServerText("festival_kitchen_gods"),
              },
              {
                date: qingmingDate(y),
                key: "thanh-minh",
                title: familyServerText("festival_qingming"),
              },
            );
            for (const festival of festivals) {
              const date = isoDate(festival.date).replaceAll("-", "");
              lines.push(
                "BEGIN:VEVENT",
                `UID:festival-${festival.key}-${y}@chuamay.org`,
                `DTSTART;VALUE=DATE:${date}`,
                `SUMMARY:${festival.title}`,
                "END:VEVENT",
              );
            }
          }
        }
        lines.push("END:VCALENDAR");
        res.writeHead(200, {
          "Content-Type": "text/calendar; charset=utf-8",
          "Cache-Control": "private, no-store",
          "Content-Disposition": 'inline; filename="chuamay.ics"',
        });
        metric("ics_export");
        res.end(lines.join("\r\n"));
        return true;
      }
      if (route === "/family/reminders/unsubscribe" && req.method === "GET") {
        const raw = new URL(req.url, "http://localhost").searchParams.get(
            "token",
          ),
          userId = validUnsubscribe(raw);
        if (!userId || !family.unsubscribeEmail(userId))
          return json(res, 404, { ok: false, error: "unsubscribe" }), true;
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex, nofollow",
        });
        res.end(
          `<!doctype html><meta charset=utf-8><title>${escapeFamilyHTML(familyServerText("unsubscribe_title", {}, language))}</title><p>${escapeFamilyHTML(familyServerText("unsubscribe_done", {}, language))}</p>`,
        );
        return true;
      }
      if (route === "/family/presale/config" && req.method === "GET")
        return json(res, 200, { ok: true, open: settings.calendarPresale.open, ...(settings.calendarPresale.open ? settings.calendarPresale : {}) }), true;
      if (route === "/family/presale/interests" && req.method === "POST") {
        const value = interestInput(await body(req)), ip = hash(settings.hashSecret, clientIP(req, settings.trustLocal));
        if (!family.rate("interest:" + ip, Date.now() + 60000)) return json(res, 429, { ok: false, error: "rate_limit" }), true;
        const created = family.createInterest(value);
        return json(res, 201, { ok: true, id: created.id }), true;
      }
      if (route === "/family/presale/orders" && req.method === "POST") {
        if (!settings.calendarPresale.open) return json(res, 403, { ok: false, error: "not_open" }), true;
        const value = preorderInput(await body(req)), ip = hash(settings.hashSecret, clientIP(req, settings.trustLocal));
        if (!family.rate("preorder:" + ip, Date.now() + 60000)) return json(res, 429, { ok: false, error: "rate_limit" }), true;
        const created = family.createPreorder(user?.user_id, value);
        return json(res, 201, { ok: true, order: created, reference: settings.calendarPresale.reference.replace("{order}", created.id.slice(0, 8).toUpperCase()) }), true;
      }
      if (!user) return json(res, 401, { ok: false, error: "auth" }), true;
      if (route === "/family/consent" && req.method === "GET") {
        const consent = family.consent(user.user_id);
        return json(res, 200, { ok: true, accepted: consent?.version === CONSENT_VERSION, consent, version: CONSENT_VERSION }), true;
      }
      if (route === "/family/consent" && req.method === "POST") {
        const value = await body(req);
        if (value.agree !== true || value.version !== CONSENT_VERSION) return json(res, 400, { ok: false, error: "consent" }), true;
        return json(res, 200, { ok: true, consent: family.acceptConsent(user.user_id, CONSENT_VERSION) }), true;
      }
      if (route === "/family/calendar.pdf" && req.method === "POST") {
        const v = await body(req),
          year = Number(v.year),
          pdf = await calendarPdf({
            familyName: v.familyName,
            tablets: family.listTablets(user.user_id),
            year,
            leapRule: settings.lunarLeapRule,
          }, { python: settings.calendarPython });
        res.writeHead(200, {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="lich-ngay-gio-${year}.pdf"`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        });
        metric("calendar_pdf_view");
        res.end(pdf);
        return true;
      }
      if (route === "/family/tablets" && req.method === "GET")
        return (
          json(res, 200, {
            ok: true,
            tablets: family.listTablets(user.user_id),
          }),
          true
        );
      if (route === "/family/tablets" && req.method === "POST") {
        if (family.consent(user.user_id)?.version !== CONSENT_VERSION)
          return json(res, 428, { ok: false, error: "consent_required", version: CONSENT_VERSION }), true;
        const v = tabletInput(await body(req)),
          requestId = String(req.headers["idempotency-key"] || "");
        if (requestId && !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId))
          return json(res, 400, { ok: false, error: "request_id" }), true;
        const duplicate = requestId && family.member(user.user_id, requestId),
          created = duplicate || family.createTablet(user.user_id, v, requestId || undefined);
        return json(res, duplicate ? 200 : 201, { ok: true, tablet: created }), true;
      }
      const memberMatch = route.match(
        /^\/family\/tablets\/([0-9a-f-]{36})\/members\/([0-9a-f-]{36})$/i,
      );
      if (memberMatch && req.method === "DELETE") {
        const removed = family.removeMember(
          user.user_id,
          memberMatch[1],
          memberMatch[2],
        );
        return (
          json(
            res,
            removed ? 200 : 403,
            removed ? { ok: true } : { ok: false, error: "owner" },
          ),
          true
        );
      }
      const leaveMatch = route.match(/^\/family\/tablets\/([0-9a-f-]{36})\/membership$/i);
      if (leaveMatch && req.method === "DELETE") {
        const left = family.leaveTablet(user.user_id, leaveMatch[1]);
        return json(res, left ? 200 : 403, left ? { ok: true } : { ok: false, error: "owner" }), true;
      }
      const inviteMatch = route.match(
        /^\/family\/tablets\/([0-9a-f-]{36})\/invites\/([0-9a-f-]{36})$/i,
      );
      if (inviteMatch && req.method === "DELETE") {
        const revoked = family.revokeInvite(
          user.user_id,
          inviteMatch[1],
          inviteMatch[2],
        );
        return (
          json(
            res,
            revoked ? 200 : 403,
            revoked ? { ok: true } : { ok: false, error: "owner" },
          ),
          true
        );
      }
      const match = route.match(
        /^\/family\/tablets\/([0-9a-f-]{36})(?:\/(offerings|invites))?$/i,
      );
      if (match) {
        const [, id, child] = match,
          m = family.member(user.user_id, id);
        if (!m) return json(res, 404, { ok: false, error: "tablet" }), true;
        if (!child && req.method === "GET") {
          const current = anniversary(
            {
              day: m.death_lunar_day,
              month: m.death_lunar_month,
              leap: !!m.death_lunar_leap,
            },
            new Date().getFullYear(),
            settings.lunarLeapRule,
          );
          metric("memorial_view");
          return json(res, 200, { ok: true, tablet: m, solar: current }), true;
        }
        if (!child && req.method === "PATCH") {
          const changed = family.updateTablet(
            user.user_id,
            id,
            tabletInput(await body(req)),
          );
          return (
            json(
              res,
              changed ? 200 : 403,
              changed
                ? { ok: true, tablet: changed }
                : { ok: false, error: "owner" },
            ),
            true
          );
        }
        if (!child && req.method === "DELETE")
          return (
            json(res, family.deleteTablet(user.user_id, id) ? 200 : 403, {
              ok: true,
            }),
            true
          );
        if (child === "offerings" && req.method === "POST") {
          const v = await body(req);
          if (!["incense", "flower", "fruit", "tea"].includes(v.kind))
            return json(res, 400, { ok: false, error: "kind" }), true;
          const count = family.offer(user.user_id, id, v.kind);
          if (count != null) metric("offering_complete", v.kind);
          return json(res, count == null ? 403 : 201, count == null ? { ok: false, error: "owner" } : { ok: true, count }), true;
        }
        if (child === "invites" && req.method === "POST") {
          if (m.role !== "owner")
            return json(res, 403, { ok: false, error: "owner" }), true;
          const raw = token(24),
            v = await body(req),
            max = Math.max(1, Math.min(20, Number(v.maxUses) || 20));
          family.invite(
            user.user_id,
            id,
            hash(settings.hashSecret, raw),
            Date.now() + 30 * 86400000,
            max,
          );
          return (
            json(res, 201, {
              ok: true,
              url: `${settings.familyUrl}#invite=${raw}`,
            }),
            true
          );
        }
      }
      if (route === "/family/invites/accept" && req.method === "POST") {
        const v = await body(req), tokenHash = hash(settings.hashSecret, String(v.token || "")), info = family.inviteInfo(tokenHash), wasMember = info ? !!family.member(user.user_id, info.tablet_id) : false,
          joined = family.acceptInvite(user.user_id, tokenHash);
        if (joined && !wasMember) metric("member_invite_accept");
        return (
          json(
            res,
            joined ? 200 : 404,
            joined
              ? { ok: true, tablet: joined }
              : { ok: false, error: "invite" },
          ),
          true
        );
      }
      if (route === "/family/reminders" && req.method === "GET")
        return (
          json(res, 200, {
            ok: true,
            prefs: family.prefs(user.user_id),
            telegramEnabled: settings.telegramEnabled,
          }),
          true
        );
      if (route === "/family/reminders" && req.method === "PUT") {
        const v = await body(req),
          raw = v.calendar === true ? token(24) : null,
          prefs = family.setPrefs(user.user_id, {
            email: v.email === true,
            telegram: v.telegram === true,
            festival: v.festival !== false,
            telegramChat: null,
            icsHash: raw ? hash(settings.hashSecret, raw) : null,
          });
        if (v.calendar === false) family.revokeCalendar(user.user_id);
        metric("reminder_set");
        return (
          json(res, 200, {
            ok: true,
            prefs: family.prefs(user.user_id),
            calendarURL: raw
              ? `${settings.familyUrl.replace("/family.html", "")}/api/family/calendar.ics?token=${raw}`
              : null,
          }),
          true
        );
      }
      if (route === "/family/account/export" && req.method === "GET")
        return (
          json(
            res,
            200,
            { ok: true, data: family.exportUser(user.user_id) },
            {
              "Content-Disposition":
                'attachment; filename="chuamay-family.json"',
            },
          ),
          true
        );
      if (route === "/family/account" && req.method === "DELETE") {
        family.deleteUser(user.user_id);
        res.setHeader(
          "Set-Cookie",
          `ct_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax${cookieDomain}`,
        );
        return json(res, 200, { ok: true }), true;
      }
      if (route === "/family/convert" && req.method === "POST") {
        const raw = await body(req),
          v = {
            kind: raw.kind,
            day: Number(raw.day),
            month: Number(raw.month),
            year: Number(raw.year),
            leap: raw.leap === true,
          };
        if (v.kind === "solar") {
          if (!validSolarDate(v)) throw Error("invalid_date");
          return json(res, 200, { ok: true, lunar: solarToLunar(v) }), true;
        }
        if (v.kind === "lunar") {
          let solar;
          try {
            solar = lunarToSolar(v);
          } catch {
            throw Error("invalid_date");
          }
          const roundTrip = solarToLunar(solar);
          if (
            roundTrip.day !== v.day ||
            roundTrip.month !== v.month ||
            roundTrip.year !== v.year ||
            roundTrip.leap !== v.leap
          )
            throw Error("invalid_date");
          return json(res, 200, { ok: true, solar }), true;
        }
        throw Error("invalid_date");
      }
      return json(res, 404, { ok: false, error: "route" }), true;
    } catch (error) {
      const known = [
        "invalid",
        "invalid_date",
        "invalid_family_name",
        "invalid_calendar_year",
        "death_year_required",
        "tablet_limit",
        "body",
      ].includes(error.message)
        ? 400
        : 503;
      return (
        json(res, known, {
          ok: false,
          error: known === 400 ? error.message : "unavailable",
          ...(error.message === "death_year_required"
            ? {
                message: familyServerText(
                  "death_year_required",
                  {},
                  familyServerLanguage(req),
                ),
              }
            : {}),
        }),
        true
      );
    }
  };
}
