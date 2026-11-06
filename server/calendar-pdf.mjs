import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { anniversary, isoDate, qingmingDate, solarToLunar } from "./lunar-hnd.mjs";

const MONTHS = [
  "Tháng Một", "Tháng Hai", "Tháng Ba", "Tháng Tư", "Tháng Năm", "Tháng Sáu",
  "Tháng Bảy", "Tháng Tám", "Tháng Chín", "Tháng Mười", "Tháng Mười Một", "Tháng Mười Hai",
];

const FESTIVALS = new Map([
  ["1-1", "Tết Nguyên Đán"],
  ["15-1", "Rằm tháng Giêng"],
  ["10-3", "Giỗ Tổ Hùng Vương"],
  ["15-4", "Lễ Phật Đản"],
  ["15-7", "Lễ Vu Lan"],
  ["15-8", "Tết Trung Thu"],
  ["23-12", "Ông Công Ông Táo"],
]);

export function normalizeCalendarFamilyName(value) {
  const name = String(value || "").normalize("NFC").trim().replace(/\s+/g, " ");
  if (name.length < 3 || name.length > 80 || /[<>\u0000-\u001f\u007f]/u.test(name))
    throw Error("invalid_family_name");
  return name;
}

export function buildFamilyCalendarModel({ familyName, tablets, year = 2027, leapRule = "regular-month" }) {
  if (!Number.isInteger(year) || year !== 2027) throw Error("invalid_calendar_year");
  const title = normalizeCalendarFamilyName(familyName),
    memorials = new Map(),
    qingming = isoDate(qingmingDate(year));
  for (const tablet of tablets || []) {
    const date = anniversary({
      day: Number(tablet.death_lunar_day),
      month: Number(tablet.death_lunar_month),
      leap: Boolean(tablet.death_lunar_leap),
    }, year, leapRule), key = isoDate(date), honorific = String(tablet.honorific || "").normalize("NFC").trim();
    if (!honorific || honorific.length > 40) continue;
    const labels = memorials.get(key) || [];
    labels.push(`Giỗ ${honorific}`);
    memorials.set(key, labels);
  }
  const months = [];
  for (let month = 1; month <= 12; month++) {
    const first = new Date(Date.UTC(year, month - 1, 1)),
      days = new Date(Date.UTC(year, month, 0)).getUTCDate(),
      leading = (first.getUTCDay() + 6) % 7,
      cells = Array.from({ length: leading }, () => null);
    for (let day = 1; day <= days; day++) {
      const lunar = solarToLunar({ day, month, year }), key = `${lunar.day}-${lunar.month}`,
        dateKey = isoDate({ day, month, year }), events = [...(memorials.get(dateKey) || [])];
      if (dateKey === qingming) events.push("Tết Thanh Minh");
      if (FESTIVALS.has(key)) events.push(FESTIVALS.get(key));
      else if (lunar.day === 1) events.push("Mùng 1");
      else if (lunar.day === 15) events.push("Ngày Rằm");
      cells.push({
        solarDay: day,
        lunar: `${lunar.day}/${lunar.month}${lunar.leap ? " nhuận" : ""}`,
        events: events.slice(0, 3),
      });
    }
    while (cells.length % 7) cells.push(null);
    months.push({ number: month, name: MONTHS[month - 1], cells });
  }
  return { year, familyName: title, months, note: "Bản mẫu · Nội dung tiếng Việt chờ người bản ngữ duyệt" };
}

export function createFamilyCalendarPdf(input, options = {}) {
  const model = buildFamilyCalendarModel(input),
    script = fileURLToPath(new URL("./calendar-pdf.py", import.meta.url)),
    font = options.fontPath || fileURLToPath(new URL("../assets/fonts/BeVietnamPro-Regular.ttf", import.meta.url)),
    python = options.python || process.env.CALENDAR_PYTHON || "python3";
  return new Promise((resolve, reject) => {
    const child = spawn(python, ["-I", script, font], { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    const out = [], err = [];
    let size = 0, settled = false;
    const timer = setTimeout(() => child.kill(), options.timeoutMs || 15000);
    child.stdout.on("data", (chunk) => {
      size += chunk.length;
      if (size > 12 * 1024 * 1024) child.kill();
      else out.push(chunk);
    });
    child.stderr.on("data", (chunk) => err.push(chunk));
    child.on("error", (error) => { if (!settled) { settled = true; clearTimeout(timer); reject(error); } });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const pdf = Buffer.concat(out);
      if (code !== 0 || !pdf.subarray(0, 5).equals(Buffer.from("%PDF-")))
        reject(Error(`calendar_pdf_failed:${Buffer.concat(err).toString("utf8").slice(0, 300)}`));
      else resolve(pdf);
    });
    child.stdin.end(JSON.stringify(model));
  });
}
