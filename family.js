import { familyEvent } from "./family-analytics.js";
import { familyText as t, FAMILY_COPY } from "./family-i18n.js";
import { FAMILY_CONSENT_COPY, FAMILY_CONSENT_VERSION } from "./family-consent.js";
import { apiURL } from "./telegram.js";
const $ = (s) => document.querySelector(s),
  screen = $("#screen"),
  status = $("#status"),
  demo = new URLSearchParams(location.search).has("demo");
const inviteKey = "ct-family-invite";
const periods = {
    dawn: t("period_dawn"),
    day: t("period_day"),
    dusk: t("period_dusk"),
    night: t("period_night"),
  },
  hour = new Date().getHours(),
  requested = new URLSearchParams(location.search).get("period"),
  period =
    demo && requested in periods
      ? requested
      : hour >= 5 && hour < 8
        ? "dawn"
        : hour < 17
          ? "day"
          : hour < 19
            ? "dusk"
            : "night";
$("#period").textContent = periods[period];
document.title = t("page_title");
document.querySelector("h1").textContent = t("altar_title");
document.querySelector("header>a").setAttribute("aria-label", t("back_temple"));
$("#account").setAttribute("aria-label", t("account_aria"));
let csrf = "",
  tablets = [],
  current = null;
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const demoTablets = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    honorific: "Bà ngoại",
    full_name: "Nguyễn An",
    birth_year: 1932,
    death_year: 2015,
    death_lunar_day: 12,
    death_lunar_month: 3,
    death_lunar_leap: 0,
    role: "owner",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    honorific: "Ông nội",
    full_name: "Trần Minh",
    birth_year: 1930,
    death_year: 2010,
    death_lunar_day: 8,
    death_lunar_month: 7,
    death_lunar_leap: 0,
    role: "family",
  },
];
async function api(path, options = {}) {
  const r = await fetch(apiURL("/family" + path), {
      credentials: "include",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        ...options.headers,
      },
    }),
    data = await r.json();
  if (!r.ok) throw Error(data.message || data.error || "unavailable");
  return data;
}
function note(text) {
  status.textContent = text;
  setTimeout(() => {
    if (status.textContent === text) status.textContent = "";
  }, 2500);
}
document.addEventListener(
  "click",
  () => {
    status.textContent = "";
  },
  true,
);
function embedded() {
  return telegramEmbedded() || /FBAN|FBAV|Zalo|Instagram|Messenger/i.test(
    navigator.userAgent,
  );
}
function telegramEmbedded() {
  return (
    new URLSearchParams(location.search).get("telegram") === "1" ||
    /Telegram/i.test(navigator.userAgent)
  );
}
function rememberInvite(raw) {
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(String(raw || ""))) return "";
  try {
    sessionStorage.setItem(inviteKey, raw);
  } catch {}
  return raw;
}
function pendingInvite() {
  try {
    return sessionStorage.getItem(inviteKey) || "";
  } catch {
    return "";
  }
}
function clearInvite() {
  try {
    sessionStorage.removeItem(inviteKey);
  } catch {}
}
function captureInvite() {
  const match = location.hash.match(/^#invite=([^&]+)$/);
  if (match) {
    let raw = "";
    try {
      raw = decodeURIComponent(match[1]);
    } catch {}
    rememberInvite(raw);
    history.replaceState(history.state, "", location.pathname + location.search);
  }
  return pendingInvite();
}
function login() {
  const invite = pendingInvite(),
    telegram = telegramEmbedded(),
    webview = embedded(),
    googleChoice = telegram
      ? ""
      : webview
        ? `<p class="muted">${t("open_browser_google")}</p>`
        : `<a class="google" href="${apiURL("/auth/google/start")}">${t("google_sign_in")}</a>`,
    telegramChoice = telegram
      ? ""
      : `<a href="/?telegram=1" class="muted">${t("open_telegram")}</a>`;
  screen.innerHTML = `<section class="login"><h2>${t("login_title")}</h2>${invite ? `<p>${t("invite_after_login")}</p>` : ""}<p>${t("login_privacy")}</p>${googleChoice}<form id="email-login"><input name="email" type="email" autocomplete="email" maxlength="254" placeholder="${t("email_placeholder")}" required><button class="primary">${t("send_code")}</button></form><form id="code-form" hidden><input name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" placeholder="${t("code_placeholder")}" required><button class="primary">${t("sign_in")}</button></form>${telegramChoice}</section>`;
  const first = $("#email-login"),
    codes = $("#code-form");
  const google = $(".google");
  if (google) google.onclick = () => rememberInvite(invite);
  first.onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api("/auth/email/start", {
        method: "POST",
        body: JSON.stringify({ email: first.email.value }),
      });
      codes.hidden = false;
      first.querySelector("button").disabled = true;
      note(t("code_valid"));
    } catch (err) {
      note(
        err.message === "not_found"
          ? t("not_open")
          : err.message === "rate_limit"
            ? t("retry_later")
            : t("send_code_failed"),
      );
    }
  };
  codes.onsubmit = async (e) => {
    e.preventDefault();
    try {
      const d = await api("/auth/email/verify", {
        method: "POST",
        body: JSON.stringify({
          email: first.email.value,
          code: codes.code.value,
        }),
      });
      csrf = d.csrf;
      const savedInvite = pendingInvite();
      if (savedInvite) await inviteLanding(savedInvite, true);
      else await list();
    } catch {
      note(t("code_invalid"));
    }
  };
}
async function list() {
  tablets = demo ? demoTablets : (await api("/tablets")).tablets;
  screen.innerHTML = `<section class="list"><h2>${t("relatives")}</h2><p class="muted">${t("demo_only")}</p><div>${tablets.map((tablet) => `<button class="card" data-id="${tablet.id}"><b>${esc(tablet.honorific)} · ${esc(tablet.full_name)}</b><small>${tablet.death_lunar_day}/${tablet.death_lunar_month} ${t("lunar_suffix")}</small></button>`).join("") || `<p>${t("no_tablets")}</p>`}</div><button class="primary" id="new">${t("new_tablet")}</button></section>`;
  screen
    .querySelectorAll("[data-id]")
    .forEach((b) => (b.onclick = () => showTablet(b.dataset.id)));
  $("#new").onclick = () => consentThenForm();
  location.hash = "list";
}
async function consentThenForm() {
  if (demo) return form();
  const state = await api("/consent");
  if (state.accepted) return form();
  screen.innerHTML = `<section class="consent"><h2>${FAMILY_CONSENT_COPY.title}</h2><p class="review">${FAMILY_CONSENT_COPY.review}</p><div lang="vi">${FAMILY_CONSENT_COPY.vi.map((item) => `<p>${esc(item)}</p>`).join("")}</div><details lang="zh"><summary>中文对照</summary>${FAMILY_CONSENT_COPY.zh.map((item) => `<p>${esc(item)}</p>`).join("")}</details><label><input id="consent-agree" type="checkbox"> ${FAMILY_CONSENT_COPY.agree}</label><button class="primary" id="consent-continue" disabled>${FAMILY_CONSENT_COPY.continue}</button><button id="consent-cancel">${FAMILY_CONSENT_COPY.cancel}</button></section>`;
  const agree = $("#consent-agree"), proceed = $("#consent-continue");
  agree.onchange = () => { proceed.disabled = !agree.checked; };
  proceed.onclick = async () => {
    proceed.disabled = true;
    try {
      await api("/consent", { method: "POST", body: JSON.stringify({ agree: true, version: FAMILY_CONSENT_VERSION }) });
      form();
    } catch {
      proceed.disabled = false;
      note(t("retry_later"));
    }
  };
  $("#consent-cancel").onclick = list;
  location.hash = "consent";
}
function plaque(t) {
  const name = esc(t.full_name.normalize("NFC")),
    years = [t.birth_year, t.death_year].filter(Boolean).join(" – ");
  return `<button class="plaque" data-id="${t.id}"><img src="assets/family/tablet.webp" alt=""><span class="plaque-label"><span>${esc(t.honorific)}</span><b>${name}</b>${years ? `<small>${years}</small>` : ""}</span></button>`;
}
async function showTablet(id) {
  current = tablets.find((t) => t.id === id);
  let solar = { day: 18, month: 4, year: new Date().getFullYear() };
  if (!demo) {
    const d = await api("/tablets/" + id);
    current = d.tablet;
    solar = d.solar;
  }
  const shown = tablets.slice(0, 3),
    many = shown.length > 1;
  screen.innerHTML = `<section class="scene" style="background-image:url(assets/family/altar-${many ? "three-" : ""}${period}.webp)"><div class="plaque-row">${shown.map(plaque).join("")}</div><svg class="smoke hidden" viewBox="0 0 50 110" aria-hidden="true"><g fill="none" stroke="#eee4d6" stroke-width="2.8" opacity=".78"><path d="M25 48c-12-19 12-26 4-47"/><path class="extra" d="M16 52c10-16-11-24-2-41M34 52c-4-12 10-23 3-33"/></g><g stroke="#723e27" stroke-width="2.4"><path d="m16 52 5 57m4-61v61m9-57-5 57"/></g><g class="embers"><circle cx="16" cy="52" r="3"/><circle cx="25" cy="48" r="3"/><circle cx="34" cy="52" r="3"/></g></svg><div class="panel"><p>${t("anniversary", { lunar: `${current.death_lunar_day}/${current.death_lunar_month}`, solar: `${solar.day}/${solar.month}/${solar.year}` })}</p>${["incense", "flower", "fruit", "tea"].map((kind) => `<button data-kind="${kind}">${t(kind)}</button>`).join("")}<button class="wide" id="invite">${t("invite_family")}</button><button class="wide" id="back">${t("back_list")}</button></div></section>`;
  screen.querySelectorAll("[data-kind]").forEach(
    (b) =>
      (b.onclick = async () => {
        if (b.dataset.kind === "incense") {
          $(".scene").classList.add("lit");
          $(".smoke").classList.remove("hidden");
        }
        let count = 1;
        if (!demo) {
          const result = await api(`/tablets/${id}/offerings`, {
            method: "POST",
            body: JSON.stringify({ kind: b.dataset.kind }),
          });
          count = result.count;
        }
        familyEvent("memorial_offer", b.dataset.kind);
        note(
          b.dataset.kind === "incense"
            ? t("today_incense", { count })
            : t("offering_placed"),
        );
      }),
  );
  $("#back").onclick = list;
  $("#invite").onclick = () => invite(id);
  location.hash = "tablet=" + id;
}
function form(edit = null) {
  const tablet = edit || {},
    honorificOptions = FAMILY_COPY.honorifics
      .map((value) => `<option>${value}</option>`)
      .join("");
  screen.innerHTML = `<section class="form"><h2>${t(edit ? "form_edit" : "form_create")}</h2><form id="tablet-form"><label>${t("honorific")}<select name="honorific">${honorificOptions}</select></label><label>${t("full_name")}<input name="fullName" maxlength="100" required value="${esc(tablet.full_name || "")}"></label><div class="row"><label>${t("birth_year")}<input name="birthYear" inputmode="numeric" value="${tablet.birth_year || ""}"></label><label>${t("death_year")}<input name="deathYear" inputmode="numeric" value="${tablet.death_year || ""}"></label></div><div class="row"><label>${t("lunar_day")}<input name="day" type="number" min="1" max="30" required value="${tablet.death_lunar_day || 12}"></label><label>${t("lunar_month")}<input name="month" type="number" min="1" max="12" required value="${tablet.death_lunar_month || 3}"></label></div><label><input name="leap" type="checkbox" ${tablet.death_lunar_leap ? "checked" : ""}> ${t("leap_month")}</label><label>${t("notes")}<textarea name="note" maxlength="200">${esc(tablet.note || "")}</textarea></label><button class="primary">${t("save_tablet")}</button><button type="button" id="cancel">${t("cancel")}</button></form></section>`;
  const f = $("#tablet-form");
  f.honorific
    .closest("label")
    .insertAdjacentHTML(
      "afterend",
      `<label id="custom-honorific" hidden>${t("honorific_other")}<input name="customHonorific" maxlength="40"></label>`,
    );
  const lunarRow = f.day.closest(".row"),
    leapLabel = f.leap.closest("label");
  lunarRow.insertAdjacentHTML(
    "beforebegin",
    `<label>${t("date_type")}<select name="dateKind"><option value="lunar">${t("lunar_date")}</option><option value="solar">${t("solar_only")}</option></select></label><div class="row" id="solar-date" hidden><label>${t("day")}<input name="solarDay" type="number" min="1" max="31"></label><label>${t("month")}<input name="solarMonth" type="number" min="1" max="12"></label><label>${t("year")}<input name="solarYear" type="number" min="1900" max="2100"></label></div><p id="conversion" class="muted" hidden></p>`,
  );
  let converted = null;
  const updateHonorific = () => {
    const custom = $("#custom-honorific");
    custom.hidden = f.honorific.value !== FAMILY_COPY.honorifics.at(-1);
    custom.querySelector("input").required = !custom.hidden;
  };
  const updateDateKind = () => {
    const solar = f.dateKind.value === "solar";
    $("#solar-date").hidden = !solar;
    lunarRow.hidden = solar;
    leapLabel.hidden = solar;
    for (const input of [f.day, f.month, f.solarDay, f.solarMonth, f.solarYear])
      input.required = solar
        ? input.name.startsWith("solar")
        : ["day", "month"].includes(input.name);
    converted = null;
    $("#conversion").hidden = true;
  };
  f.honorific.onchange = updateHonorific;
  f.dateKind.onchange = updateDateKind;
  f.honorific.value = tablet.honorific || FAMILY_COPY.honorifics[0];
  updateHonorific();
  updateDateKind();
  f.onsubmit = async (e) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(f));
    if (v.honorific === FAMILY_COPY.honorifics.at(-1))
      v.honorific = v.customHonorific;
    if (v.dateKind === "solar") {
      if (!converted) {
        if (demo) return note(t("conversion_staging"));
        const result = await api("/convert", {
          method: "POST",
          body: JSON.stringify({
            kind: "solar",
            day: Number(v.solarDay),
            month: Number(v.solarMonth),
            year: Number(v.solarYear),
          }),
        });
        converted = result.lunar;
        const message = $("#conversion");
        message.textContent = t("conversion_result", {
          date: `${converted.day}/${converted.month}`,
          leap: converted.leap ? t("leap_suffix") : "",
        });
        message.hidden = false;
        return;
      }
      v.day = converted.day;
      v.month = converted.month;
      v.leap = converted.leap;
    }
    if (v.dateKind !== "solar") v.leap = f.leap.checked;
    for (const k of ["birthYear", "deathYear", "day", "month"])
      v[k] = v[k] ? Number(v[k]) : null;
    if (!demo) {
      try {
        await api(edit ? `/tablets/${edit.id}` : "/tablets", {
          method: edit ? "PATCH" : "POST",
          body: JSON.stringify(v),
        });
      } catch (error) {
        note(error.message);
        return;
      }
      if (!edit) familyEvent("memorial_create");
    } else if (!edit)
      demoTablets.push({
        id: crypto.randomUUID(),
        ...v,
        full_name: v.fullName,
        death_lunar_day: v.day,
        death_lunar_month: v.month,
      });
    await list();
  };
  $("#cancel").onclick = list;
  location.hash = edit ? "edit=" + edit.id : "new";
}
async function invite(id) {
  if (demo) {
    await navigator.clipboard?.writeText(
      location.origin + "/family.html#invite=demo",
    );
    familyEvent("invite_create");
    return note(t("test_link_copied"));
  }
  const d = await api(`/tablets/${id}/invites`, { method: "POST", body: "{}" });
  familyEvent("invite_create");
  if (navigator.share)
    await navigator.share({
      title: t("share_title"),
      text: t("share_text", { honorific: current.honorific }),
      url: d.url,
    });
  else {
    await navigator.clipboard.writeText(d.url);
    note(t("link_copied"));
  }
}
async function inviteLanding(raw, authenticated = false) {
  let info = {
    invite: {
      inviter: "Nguyễn An",
      honorific: "Bà ngoại",
      fullName: "Nguyễn Hoa",
    },
  };
  if (!demo)
    info = await api("/invites/info", {
      method: "POST",
      body: JSON.stringify({ token: raw }),
    });
  screen.innerHTML = `<section class="invite"><h2>${t("invite_heading", { inviter: esc(info.invite.inviter || t("relatives")) })}</h2><p>${t("invite_body", { honorific: esc(info.invite.honorific), name: esc(info.invite.fullName) })}</p>${authenticated || demo ? `<button class="primary" id="accept">${t("accept_invite")}</button>` : `<p class="muted">${t("login_to_accept")}</p><button class="primary" id="login">${t("login_first")}</button>`}</section>`;
  const accept = $("#accept"), loginButton = $("#login");
  if (accept) accept.onclick = async () => {
    try {
      if (!demo)
        await api("/invites/accept", {
          method: "POST",
          body: JSON.stringify({ token: raw }),
        });
      familyEvent("invite_accept");
      clearInvite();
      await list();
    } catch (error) {
      if (error.message === "unauthorized") {
        csrf = "";
        login();
        note(t("invite_session_expired"));
      } else note(t("invite_accept_failed"));
    }
  };
  if (loginButton) loginButton.onclick = login;
}
async function account() {
  screen.innerHTML = `<section class="account"><h2>${t("account_title")}</h2><p>${t("account_privacy")}</p><label><input id="email-remind" type="checkbox"> ${t("remind_email")}</label><label><input id="tg-remind" type="checkbox"> ${t("remind_telegram")}</label><label><input id="festival" type="checkbox" checked> ${t("remind_festival")}</label><button id="save-reminders">${t("save_reminders")}</button><button id="calendar">${t("subscribe_calendar")}</button><button id="revoke-calendar">${t("revoke_calendar")}</button><button id="export">${t("export_data")}</button><button id="delete">${t("delete_data")}</button><button id="account-back">${t("back")}</button><p class="muted">${t("native_pending")}</p></section>`;
  if (!demo) {
    const reminder = await api("/reminders");
    $("#email-remind").checked = !!reminder.prefs.email_on;
    $("#tg-remind").checked = !!reminder.prefs.telegram_on;
    $("#festival").checked = !!reminder.prefs.festival_on;
    if (!reminder.telegramEnabled) {
      $("#tg-remind").closest("label").hidden = true;
      $("#tg-remind").disabled = true;
    }
  }
  $("#account-back").onclick = list;
  $("#save-reminders").onclick = async () => {
    if (!demo)
      await api("/reminders", {
        method: "PUT",
        body: JSON.stringify({
          email: $("#email-remind").checked,
          telegram: $("#tg-remind").checked,
          festival: $("#festival").checked,
        }),
      });
    for (const [id, ch] of [
      ["email-remind", "email"],
      ["tg-remind", "telegram"],
    ])
      if ($("#" + id).checked) familyEvent("reminder_channel_set", ch);
    note(t("saved"));
  };
  $("#calendar").onclick = async () => {
    if (demo) return note(t("demo_calendar"));
    const d = await api("/reminders", {
      method: "PUT",
      body: JSON.stringify({ calendar: true, festival: true }),
    });
    familyEvent("reminder_channel_set", "calendar");
    location.href = d.calendarURL;
  };
  $("#revoke-calendar").onclick = async () => {
    if (demo) return note(t("demo_calendar"));
    await api("/reminders", {
      method: "PUT",
      body: JSON.stringify({
        calendar: false,
        festival: $("#festival").checked,
      }),
    });
    note(t("calendar_revoked"));
  };
  $("#export").onclick = () => {
    if (!demo) location.href = "/api/family/account/export";
  };
  $("#delete").onclick = async () => {
    if (!demo) await api("/account", { method: "DELETE", body: "{}" });
    login();
  };
  location.hash = "account";
}
$("#account").onclick = account;
async function init() {
  try {
    const authError = new URLSearchParams(location.search).get("auth");
    const invite = captureInvite();
    if (demo) {
      csrf = "demo";
      tablets = demoTablets;
      if (invite) return inviteLanding(invite, true);
      return list();
    }
    const s = await api("/session");
    csrf = s.csrf || "";
    if (invite) return inviteLanding(invite, !!s.authenticated);
    if (!s.authenticated) {
      login();
      if (authError)
        note(
          authError === "not_found"
            ? t("not_open")
            : authError === "google_unavailable"
            ? t("google_unavailable")
            : t("google_failed"),
        );
      return;
    }
    await list();
  } catch {
    login();
  } finally {
    $("#family-app").setAttribute("aria-busy", "false");
  }
}
init();
