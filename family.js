import { familyEvent } from "./family-analytics.js";
const $ = (s) => document.querySelector(s),
  screen = $("#screen"),
  status = $("#status"),
  demo = new URLSearchParams(location.search).has("demo");
const periods = {
    dawn: "Sớm mai",
    day: "Ban ngày",
    dusk: "Chiều muộn",
    night: "Đêm yên",
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
  const r = await fetch("/api/family" + path, {
      credentials: "same-origin",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        ...options.headers,
      },
    }),
    data = await r.json();
  if (!r.ok) throw Error(data.error || "unavailable");
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
  return /Telegram|FBAN|FBAV|Zalo|Instagram|Messenger/i.test(
    navigator.userAgent,
  );
}
function login() {
  screen.innerHTML = `<section class="login"><h2>Giữ gìn ký ức gia đình</h2><p>Tên và ngày giỗ chỉ những người được mời mới xem được. Bản dịch tiếng Việt đang chờ người bản ngữ duyệt.</p><form id="email-login"><input name="email" type="email" autocomplete="email" maxlength="254" placeholder="Email" required><button class="primary">Gửi mã 6 số</button></form><form id="code-form" hidden><input name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" placeholder="Mã xác nhận" required><button class="primary">Đăng nhập</button></form>${embedded() ? '<p class="muted">Mở bằng trình duyệt để đăng nhập Google.</p>' : '<a class="google" href="/api/auth/google/start">Đăng nhập bằng Google</a>'}<a href="/?telegram=1" class="muted">Mở trong Telegram</a></section>`;
  const first = $("#email-login"),
    codes = $("#code-form");
  first.onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api("/auth/email/start", {
        method: "POST",
        body: JSON.stringify({ email: first.email.value }),
      });
      codes.hidden = false;
      first.querySelector("button").disabled = true;
      note("Mã có hiệu lực trong 10 phút.");
    } catch (err) {
      note(
        err.message === "rate_limit"
          ? "Vui lòng thử lại sau."
          : "Không thể gửi mã.",
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
      await list();
    } catch {
      note("Mã không đúng hoặc đã hết hạn.");
    }
  };
}
async function list() {
  tablets = demo ? demoTablets : (await api("/tablets")).tablets;
  screen.innerHTML = `<section class="list"><h2>Người thân</h2><p class="muted">Chỉ dùng dữ liệu hư cấu cho tới khi sao lưu được diễn tập.</p><div>${tablets.map((t) => `<button class="card" data-id="${t.id}"><b>${esc(t.honorific)} · ${esc(t.full_name)}</b><small>${t.death_lunar_day}/${t.death_lunar_month} âm lịch</small></button>`).join("") || "<p>Chưa có bài vị.</p>"}</div><button class="primary" id="new">Lập bài vị</button></section>`;
  screen
    .querySelectorAll("[data-id]")
    .forEach((b) => (b.onclick = () => showTablet(b.dataset.id)));
  $("#new").onclick = () => form();
  location.hash = "list";
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
  screen.innerHTML = `<section class="scene" style="background-image:url(assets/family/altar-${many ? "three-" : ""}${period}.webp)"><div class="plaque-row">${shown.map(plaque).join("")}</div><svg class="smoke hidden" viewBox="0 0 50 110" aria-hidden="true"><g fill="none" stroke="#eee4d6" stroke-width="2.8" opacity=".78"><path d="M25 48c-12-19 12-26 4-47"/><path class="extra" d="M16 52c10-16-11-24-2-41M34 52c-4-12 10-23 3-33"/></g><g stroke="#723e27" stroke-width="2.4"><path d="m16 52 5 57m4-61v61m9-57-5 57"/></g><g class="embers"><circle cx="16" cy="52" r="3"/><circle cx="25" cy="48" r="3"/><circle cx="34" cy="52" r="3"/></g></svg><div class="panel"><p>Giỗ: ${current.death_lunar_day}/${current.death_lunar_month} âm lịch · năm nay ${solar.day}/${solar.month}/${solar.year}</p>${["incense", "flower", "fruit", "tea"].map((k, i) => `<button data-kind="${k}">${["Thắp hương", "Dâng hoa", "Dâng quả", "Dâng trà"][i]}</button>`).join("")}<button class="wide" id="invite">Mời người thân</button><button class="wide" id="back">Về danh sách</button></div></section>`;
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
            ? `Hôm nay có ${count} người trong gia đình đã thắp hương.`
            : "Lễ vật đã được đặt lên bàn thờ.",
        );
      }),
  );
  $("#back").onclick = list;
  $("#invite").onclick = () => invite(id);
  location.hash = "tablet=" + id;
}
function form(edit = null) {
  const t = edit || {};
  screen.innerHTML = `<section class="form"><h2>${edit ? "Sửa" : "Lập"} bài vị</h2><form id="tablet-form"><label>Cách xưng hô<select name="honorific"><option>Bà ngoại</option><option>Ông ngoại</option><option>Bà nội</option><option>Ông nội</option><option>Bố</option><option>Mẹ</option><option value="Khác">Khác</option></select></label><label>Họ và tên<input name="fullName" maxlength="100" required value="${esc(t.full_name || "")}"></label><div class="row"><label>Năm sinh<input name="birthYear" inputmode="numeric" value="${t.birth_year || ""}"></label><label>Năm mất<input name="deathYear" inputmode="numeric" value="${t.death_year || ""}"></label></div><div class="row"><label>Ngày âm<input name="day" type="number" min="1" max="30" required value="${t.death_lunar_day || 12}"></label><label>Tháng âm<input name="month" type="number" min="1" max="12" required value="${t.death_lunar_month || 3}"></label></div><label><input name="leap" type="checkbox" ${t.death_lunar_leap ? "checked" : ""}> Tháng nhuận</label><label>Ghi chú<textarea name="note" maxlength="200">${esc(t.note || "")}</textarea></label><button class="primary">Lưu bài vị</button><button type="button" id="cancel">Hủy</button></form></section>`;
  const f = $("#tablet-form");
  for (const value of ["Anh", "Chị", "Em"])
    f.honorific.add(new Option(value, value), f.honorific.options.length - 1);
  f.honorific.closest("label").insertAdjacentHTML(
    "afterend",
    '<label id="custom-honorific" hidden>Cách xưng hô khác<input name="customHonorific" maxlength="40"></label>',
  );
  const lunarRow = f.day.closest(".row"),
    leapLabel = f.leap.closest("label");
  lunarRow.insertAdjacentHTML(
    "beforebegin",
    '<label>Loại ngày<select name="dateKind"><option value="lunar">Ngày âm lịch</option><option value="solar">Tôi chỉ biết ngày dương lịch</option></select></label><div class="row" id="solar-date" hidden><label>Ngày<input name="solarDay" type="number" min="1" max="31"></label><label>Tháng<input name="solarMonth" type="number" min="1" max="12"></label><label>Năm<input name="solarYear" type="number" min="1900" max="2100"></label></div><p id="conversion" class="muted" hidden></p>',
  );
  let converted = null;
  const updateHonorific = () => {
    const custom = $("#custom-honorific");
    custom.hidden = f.honorific.value !== "Khác";
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
  f.honorific.value = t.honorific || "Bà ngoại";
  updateHonorific();
  updateDateKind();
  f.onsubmit = async (e) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(f));
    if (v.honorific === "Khác") v.honorific = v.customHonorific;
    if (v.dateKind === "solar") {
      if (!converted) {
        if (demo) return note("Chuyển đổi ngày chỉ có trên staging đã đăng nhập.");
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
        message.textContent = `Ngày âm lịch tương ứng: ${converted.day}/${converted.month}${converted.leap ? " (tháng nhuận)" : ""}. Vui lòng kiểm tra rồi bấm Lưu lần nữa.`;
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
      const d = await api(edit ? `/tablets/${edit.id}` : "/tablets", {
        method: edit ? "PATCH" : "POST",
        body: JSON.stringify(v),
      });
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
    return note("Đã sao chép liên kết thử nghiệm.");
  }
  const d = await api(`/tablets/${id}/invites`, { method: "POST", body: "{}" });
  familyEvent("invite_create");
  if (navigator.share)
    await navigator.share({
      title: "Bàn thờ gia tiên",
      text: `Mời bạn cùng tưởng nhớ ${current.honorific}`,
      url: d.url,
    });
  else {
    await navigator.clipboard.writeText(d.url);
    note("Đã sao chép liên kết.");
  }
}
async function inviteLanding(raw) {
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
  screen.innerHTML = `<section class="invite"><h2>${esc(info.invite.inviter || "Người thân")} mời bạn</h2><p>Cùng tưởng nhớ ${esc(info.invite.honorific)} ${esc(info.invite.fullName)}.</p><button class="primary" id="accept">Nhận lời mời</button><button id="login">Đăng nhập trước</button></section>`;
  $("#accept").onclick = async () => {
    if (!demo)
      await api("/invites/accept", {
        method: "POST",
        body: JSON.stringify({ token: raw }),
      });
    familyEvent("invite_accept");
    await list();
  };
  $("#login").onclick = login;
}
async function account() {
  screen.innerHTML = `<section class="account"><h2>Tài khoản và quyền riêng tư</h2><p>Dữ liệu chỉ dành cho gia đình được mời. Xóa tài khoản sẽ xóa ngay dữ liệu đang hoạt động; bản sao lưu được loại bỏ trong vòng 30 ngày.</p><label><input id="email-remind" type="checkbox"> Nhắc qua email</label><label><input id="tg-remind" type="checkbox"> Nhắc qua Telegram</label><label><input id="festival" type="checkbox" checked> Nhắc ngày lễ</label><button id="save-reminders">Lưu nhắc nhở</button><button id="calendar">Đăng ký lịch điện thoại</button><button id="export">Xuất toàn bộ dữ liệu</button><button id="delete">Xóa toàn bộ dữ liệu</button><button id="account-back">Quay lại</button><p class="muted">Văn bản tiếng Việt đang chờ người bản ngữ duyệt.</p></section>`;
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
    note("Đã lưu.");
  };
  $("#calendar").onclick = async () => {
    if (demo) return note("Lịch thử nghiệm chưa được tạo.");
    const d = await api("/reminders", {
      method: "PUT",
      body: JSON.stringify({ calendar: true, festival: true }),
    });
    familyEvent("reminder_channel_set", "calendar");
    location.href = d.calendarURL;
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
    const invite = location.hash.match(/^#invite=(.+)$/)?.[1];
    if (demo) {
      csrf = "demo";
      tablets = demoTablets;
      if (invite) return inviteLanding(invite);
      return list();
    }
    const s = await api("/session");
    csrf = s.csrf || "";
    if (invite) return inviteLanding(invite);
    if (!s.authenticated) {
      login();
      if (authError)
        note(
          authError === "google_unavailable"
            ? "Đăng nhập Google chưa được bật. Vui lòng dùng email."
            : "Không thể đăng nhập Google. Hãy dùng tài khoản thử nghiệm hoặc email.",
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
