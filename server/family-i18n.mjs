// Family-pilot server copy. Every Vietnamese value remains pending native-speaker review.
export const FAMILY_SERVER_COPY = Object.freeze({
  vi: Object.freeze({
    death_year_required:
      "Vui lòng nhập năm mất để kiểm tra ngày 30 hoặc tháng nhuận có tồn tại trong năm đó.",
    otp_subject: "Mã đăng nhập Chùa Mây",
    otp_text: "Mã đăng nhập của bạn: {code}\nMã có hiệu lực trong 10 phút.",
    otp_html:
      "<p>Mã đăng nhập của bạn: <strong>{code}</strong></p><p>Mã có hiệu lực trong 10 phút.</p>",
    relative_default: "Người thân",
    calendar_anniversary: "Giỗ {honorific}",
    festival_tet: "Tết",
    festival_new_moon: "Mùng một",
    festival_vu_lan: "Vu Lan",
    festival_full_moon: "Ngày rằm",
    festival_kitchen_gods: "Ông Công Ông Táo",
    festival_qingming: "Thanh minh",
    unsubscribe_title: "Chùa Mây",
    unsubscribe_done: "Đã tắt nhắc nhở qua email.",
    reminder_subject: "Nhắc ngày tưởng nhớ · Chùa Mây",
    reminder_open: "Mở Chùa Mây",
    reminder_unsubscribe: "Tắt nhắc nhở",
    reminder_unsubscribe_email: "Tắt nhắc nhở qua email",
    anniversary_reminder:
      "Còn {days} ngày tới giỗ {honorific}. Mời bạn trở lại thắp một nén hương.",
    festival_reminder:
      "Ngày mai là {festival}. Mời bạn trở lại thắp một nén hương.",
  }),
  en: Object.freeze({
    death_year_required:
      "Enter the year of death so this day 30 or leap month can be verified for that year.",
    otp_subject: "Your Chùa Mây sign-in code",
    otp_text: "Your sign-in code: {code}\nThis code is valid for 10 minutes.",
    otp_html:
      "<p>Your sign-in code: <strong>{code}</strong></p><p>This code is valid for 10 minutes.</p>",
    relative_default: "Family member",
    calendar_anniversary: "Remembrance day for {honorific}",
    festival_tet: "Tết",
    festival_new_moon: "New moon day",
    festival_vu_lan: "Vu Lan",
    festival_full_moon: "Full moon day",
    festival_kitchen_gods: "Kitchen Gods Day",
    festival_qingming: "Thanh minh",
    unsubscribe_title: "Chùa Mây",
    unsubscribe_done: "Email reminders have been turned off.",
    reminder_subject: "Remembrance reminder · Chùa Mây",
    reminder_open: "Open Chùa Mây",
    reminder_unsubscribe: "Turn off reminders",
    reminder_unsubscribe_email: "Turn off email reminders",
    anniversary_reminder:
      "{days} days until the remembrance day for {honorific}. You are welcome to return and light a stick of incense.",
    festival_reminder:
      "Tomorrow is {festival}. You are welcome to return and light a stick of incense.",
  }),
});

export function familyServerLanguage(req) {
  return /^en(?:-|,|;|$)/i.test(String(req?.headers?.["accept-language"] || ""))
    ? "en"
    : "vi";
}

export function familyServerText(key, params = {}, language = "vi") {
  const copy =
    FAMILY_SERVER_COPY[language]?.[key] ?? FAMILY_SERVER_COPY.vi[key];
  if (typeof copy !== "string") throw Error("family_copy_key");
  const placeholders = new Set(
    [...copy.matchAll(/\{([a-z_]+)\}/g)].map((match) => match[1]),
  );
  for (const key of Object.keys(params))
    if (!placeholders.has(key)) throw Error("family_copy_param");
  let rendered = copy;
  for (const placeholder of placeholders) {
    const value = params[placeholder];
    if (!["string", "number"].includes(typeof value))
      throw Error("family_copy_param");
    rendered = rendered.replaceAll(`{${placeholder}}`, String(value));
  }
  return rendered;
}

export const escapeFamilyHTML = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );
