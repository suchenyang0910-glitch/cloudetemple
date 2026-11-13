#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { solarToLunar, lunarToSolar } from "../server/lunar-hnd.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = (lang, month) => path.join(root, "site-content", lang, "lich-am-2027", `thang-${month}.md`);
const viWeek = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
const enWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const viLunar = ["", "tháng Giêng", "tháng Hai", "tháng Ba", "tháng Tư", "tháng Năm", "tháng Sáu", "tháng Bảy", "tháng Tám", "tháng Chín", "tháng Mười", "tháng Mười Một", "tháng Chạp"];
const enOrdinal = (month) => month === 12 ? "the twelfth lunar month" : `the ${month}${month === 1 ? "st" : month === 2 ? "nd" : month === 3 ? "rd" : "th"} lunar month`;
const iso = ({ day, month, year }) => `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
const fmt = ({ day, month, year }) => `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
const solar = (year, month, day) => ({ year, month, day });
const rowsFor = (month) => {
  const days = new Date(Date.UTC(2027, month, 0)).getUTCDate();
  return Array.from({ length: days }, (_, i) => {
    const date = solar(2027, month, i + 1);
    const lunar = solarToLunar(date);
    const weekday = new Date(Date.UTC(2027, month - 1, i + 1)).getUTCDay();
    return { date, lunar, vi: viWeek[weekday], en: enWeek[weekday] };
  });
};
const viRow = (r) => {
  const mark = r.lunar.day === 1 || r.lunar.day === 15;
  const cells = `| ${fmt(r.date)} | ${r.vi} | ${r.lunar.day} | ${viLunar[r.lunar.month]}${r.lunar.leap ? " (nhuận)" : ""} |`;
  return mark ? `**${cells}**` : cells;
};
const enRow = (r) => {
  const mark = r.lunar.day === 1 || r.lunar.day === 15;
  const cells = `| ${fmt(r.date)} | ${r.en} | ${r.lunar.day} | the ${r.lunar.month}${r.lunar.leap ? "th leap" : "th"} lunar month |`;
  return mark ? `**${cells}**` : cells;
};
const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${text.trim()}\n`); };

const allRows = [];
for (let month = 1; month <= 12; month += 1) {
  const rows = rowsFor(month);
  allRows.push(...rows);
  if (rows.length !== new Date(Date.UTC(2027, month, 0)).getUTCDate()) throw new Error(`row count failed ${month}`);
  const first = rows.find((r) => r.lunar.day === 1);
  const full = rows.find((r) => r.lunar.day === 15);
  const viIntro = `Trang này liệt kê từng ngày của tháng ${month} năm 2027 theo dương lịch, kèm thứ, ngày âm và tên tháng âm. ${first ? `Mùng 1 ${viLunar[first.lunar.month]} rơi vào ${fmt(first.date)} (${first.vi}).` : ""} ${full ? `Rằm ${viLunar[full.lunar.month]} rơi vào ${fmt(full.date)} (${full.vi}).` : ""} Dữ liệu dùng múi giờ UTC+7 và có thể đọc được khi không tải ảnh.`;
  const enIntro = `This page lists every day in Gregorian month ${month} of 2027 with its weekday, lunar day, and lunar month. ${first ? `The first day of ${enOrdinal(first.lunar.month)} is ${fmt(first.date)} (${first.en}).` : ""} ${full ? `The full moon of ${enOrdinal(full.lunar.month)} is ${fmt(full.date)} (${full.en}).` : ""} Dates use UTC+7 and remain readable without the image.`;
  const viExtra = month === 2 ? "\nTết Nguyên Đán 2027 bắt đầu vào mùng 1 tháng Giêng, ngày 06/02/2027 (Thứ Bảy)." : month === 12 ? "\nRằm tháng Chạp rơi vào ngày 11/01/2028, nên không nằm trong bảng tháng 12 năm 2027." : "";
  const enExtra = month === 2 ? "\nTết Nguyên Đán 2027 begins on the first day of the first lunar month, 06/02/2027 (Saturday)." : month === 12 ? "\nThe full moon of the twelfth lunar month falls on 11/01/2028, outside this December 2027 table." : "";
  write(out("vi", month), `# Lịch âm 2027 — tháng ${month}\n\n${viIntro}${viExtra}\n\n| Dương lịch | Thứ | Ngày âm | Tháng âm |\n|---|---|---:|---|\n${rows.map(viRow).join("\n")}\n\nTải ảnh lịch: \`/assets/calendar-2027/calendar-2027-${String(month).padStart(2, "0")}.webp\`. Cập nhật lần cuối: 2026-11-13.`);
  write(out("en", month), `# 2027 lunar calendar — Gregorian month ${month}\n\n${enIntro}${enExtra}\n\n| Gregorian date | Weekday | Lunar day | Lunar month |\n|---|---|---:|---|\n${rows.map(enRow).join("\n")}\n\nDownload image: \`/assets/calendar-2027/calendar-2027-${String(month).padStart(2, "0")}.webp\`. Last updated: 2026-11-13.`);
}

if (allRows.length !== 365) throw new Error(`expected 365 rows, got ${allRows.length}`);
if (iso(allRows.find((r) => r.date.month === 1 && r.lunar.day === 1).date) !== "2027-01-08") throw new Error("January Chạp boundary failed");
if (iso(allRows.find((r) => r.date.month === 2 && r.lunar.day === 1).date) !== "2027-02-06") throw new Error("Tết boundary failed");
if (iso(allRows.find((r) => r.date.month === 12 && r.lunar.day === 1).date) !== "2027-12-28") throw new Error("December boundary failed");

const summary = Array.from({ length: 12 }, (_, i) => {
  const lunarMonth = i + 1;
  const first = lunarToSolar({ day: 1, month: lunarMonth, year: 2027 });
  const full = lunarToSolar({ day: 15, month: lunarMonth, year: 2027 });
  return `| ${viLunar[lunarMonth]} | ${fmt(first)} | ${fmt(full)} |`;
}).join("\n");
write(path.join(root, "site-content", "vi", "lunar-calendar-2027.md"), `# Lịch âm 2027\n\nTổng quan này liệt kê mùng 1 và rằm của 12 tháng âm lịch năm 2027. Các ngày được tính theo múi giờ Việt Nam UTC+7 bằng cùng bộ chuyển đổi đã tạo các ô lịch; kết quả phù hợp với lịch âm Việt Nam thông dụng.\n\nTết Nguyên Đán 2027 bắt đầu vào mùng 1 tháng Giêng, ngày 06/02/2027 (Thứ Bảy).\n\n| Tháng âm | Mùng 1 | Rằm |\n|---|---|---|\n${summary}\n\nCác bảng theo **dương lịch** nằm tại \`/lich-am-2027/thang-1\` đến \`/lich-am-2027/thang-12\`. Ảnh tổng quan: \`/assets/calendar-2027/calendar-2027-overview.webp\`. Cập nhật lần cuối: 2026-11-13.`);
write(path.join(root, "site-content", "en", "lunar-calendar-2027.md"), `# 2027 lunar calendar\n\nThis overview lists the first day and full moon of all 12 lunar months in 2027. Dates are calculated in Vietnam time (UTC+7) with the same converter used for every calendar cell; the result follows the commonly used Vietnamese lunar calendar.\n\nTết Nguyên Đán 2027 begins on the first day of the first lunar month, 06/02/2027 (Saturday).\n\n| Lunar month | First day | Full moon |\n|---|---|---|\n${summary.replaceAll("Tháng Giêng", "1st lunar month").replaceAll("tháng ", "lunar month ")}\n\nThe **Gregorian-month** tables are at \`/lich-am-2027/thang-1\` through \`/lich-am-2027/thang-12\`. Overview image: \`/assets/calendar-2027/calendar-2027-overview.webp\`. Last updated: 2026-11-13.`);
console.log(`generated 24 monthly pages and 365 daily rows; assertions passed`);
