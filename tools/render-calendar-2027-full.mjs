#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { lunarToSolar, solarToLunar } from "../server/lunar-hnd.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "review/p53-calendar-2027");
const spec = JSON.parse(fs.readFileSync(path.join(root, "tools/calendar-2027-dates.json"), "utf8"));
const font = "C:/Windows/Fonts/NotoSansSC-VF.ttf";
const expectedWeekdays = [4, 0, 0, 3, 5, 1, 3, 6, 2, 4, 0, 2]; // Monday=0
const monthNames = (m) => m === 1 ? "Tháng 1" : m === 12 ? "Tháng 12" : `Tháng ${m}`;
const lunarLabel = (m) => m === 1 ? "Tháng Giêng" : m === 12 ? "Tháng Chạp" : `Tháng ${m} ÂL`;
const iso = ({ day, month, year }) => `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
const short = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
const daysInMonth = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate();
const mondayIndex = (year, month, day) => (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
const esc = (s) => s.replaceAll("\\", "\\\\").replaceAll(":", "\\:").replaceAll("'", "\\'");
const box = (x, y, w, h, color = "f7f1e7@0.92") => `drawbox=x=${x}:y=${y}:w=${w}:h=${h}:color=${color}:t=fill`;
const draw = (text, x, y, size, color = "2b241d", bg = false) => `drawtext=fontfile='C\\:/Windows/Fonts/NotoSansSC-VF.ttf':text='${esc(text)}':x=${x}:y=${y}:fontsize=${size}:fontcolor=${color}:borderw=1:bordercolor=${color}${bg ? ":box=1:boxcolor=f7f1e7@0.92:boxborderw=8" : ""}`;
const run = (input, output, filters) => {
  const r = spawnSync("ffmpeg", ["-y", "-i", input, "-vf", filters.join(","), "-frames:v", "1", "-c:v", "libwebp", "-q:v", "78", output], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr || `ffmpeg failed: ${output}`);
};

const calculated = spec.expected.map((row) => ({ ...row, mùng1: iso(lunarToSolar({ day: 1, month: row.month, year: spec.year })), rằm: iso(lunarToSolar({ day: 15, month: row.month, year: spec.year })) }));
for (const [i, row] of calculated.entries()) {
  for (const key of ["mùng1", "rằm"]) if (row[key] !== spec.expected[i][key]) throw new Error(`date assertion failed month ${i + 1} ${key}`);
}
const check = (condition, message) => { if (!condition) throw new Error(message); };
check(solarToLunar({ day: 1, month: 1, year: 2027 }).month === 11 && solarToLunar({ day: 1, month: 1, year: 2027 }).year === 2026, "January year boundary assertion failed");
check(solarToLunar({ day: 28, month: 12, year: 2027 }).day === 1 && solarToLunar({ day: 28, month: 12, year: 2027 }).month === 12 && solarToLunar({ day: 28, month: 12, year: 2027 }).year === 2027, "December year boundary assertion failed");
console.log(`ASSERT 2027 UTC+7: ${calculated.length * 2}/${calculated.length * 2} mùng 1/rằm dates match`);
console.log("ASSERT year boundaries: 2027-01-01=year 2026 month 11; 2027-12-28=Đinh Mùi tháng Chạp mùng 1");

const seasonalBg = { spring: "spring-bg.webp", summer: "summer-bg.webp", autumn: "autumn-bg.webp", winter: "winter-bg.webp" };
const seasonFor = (month) => month <= 3 ? "spring" : month <= 6 ? "summer" : month <= 9 ? "autumn" : "winter";
const festival = (date) => ({ "2027-02-06": "Tết", "2027-02-20": "Rằm tháng Giêng", "2027-05-20": "Phật Đản", "2027-08-16": "Vu Lan", "2027-09-15": "Trung Thu" }[date]);
for (let month = 1; month <= 12; month += 1) {
  const outputName = `calendar-2027-${String(month).padStart(2, "0")}.webp`;
  const expectedFirst = expectedWeekdays[month - 1];
  check(mondayIndex(2027, month, 1) === expectedFirst, `${outputName} first weekday assertion failed`);
  const count = daysInMonth(2027, month);
  const expectedDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  check(count === expectedDays, `${outputName} day-count assertion failed`);
  const first = mondayIndex(2027, month, 1), left = 45, top = 565, cellW = 142, cellH = 150;
  const filters = [box(35, 420, 1010, 1050), draw(`${monthNames(month)} · 2027`, 70, 450, 72, "2b241d"), ...["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((d, col) => draw(d, left + col * cellW + 48, top, 28, "2b241d"))];
  const marks = [];
  for (let day = 1; day <= count; day += 1) {
    const slot = first + day - 1, col = slot % 7, row = Math.floor(slot / 7), x = left + col * cellW, y = top + row * cellH;
    const solar = { day, month, year: 2027 }, lunar = solarToLunar(solar), date = iso(solar), mark = lunar.day === 1 || lunar.day === 15;
    if (mark) { filters.push(box(x + 4, y + 34, cellW - 8, 100, lunar.day === 1 ? "e9d3b8@0.95" : "eadcae@0.95")); marks.push(`${date}=${lunar.day === 1 ? "mùng 1" : "rằm"}`); }
    filters.push(draw(String(day), x + 50, y + 42, 44, mark ? "7b3028" : "2b241d"));
    filters.push(draw(`ÂL ${lunar.day}/${lunar.month}`, x + 18, y + 98, 24, mark ? "7b3028" : "5a4f44"));
    if (mark) filters.push(draw(lunar.day === 1 ? "Mùng 1" : "Rằm", x + 18, y + 130, 21, "7b3028"));
    if (festival(date)) filters.push(draw(festival(date), x + 18, y + 155, 19, "7b3028"));
  }
  console.log(`${outputName} title=${monthNames(month)} · 2027 first-weekday=${expectedFirst} marks=${marks.join(",")}${[...Array(count)].map((_, i) => festival(iso({ day: i + 1, month, year: 2027 }))).filter(Boolean).length ? ` festivals=${[...Array(count)].map((_, i) => festival(iso({ day: i + 1, month, year: 2027 }))).filter(Boolean).join(",")}` : ""}`);
  run(path.join(outDir, seasonalBg[seasonFor(month)]), path.join(outDir, outputName), filters);
}

const overviewBg = path.join(root, "review/p34-calendar/calendar-2027-overview-background.webp");
const overviewFilters = [draw("CHÙA MÂY · LỊCH 2027", 100, 70, 56, "2b241d")];
calculated.forEach((row, i) => {
  const x = 90 + (i % 4) * 490, y = 205 + Math.floor(i / 4) * 390;
  overviewFilters.push(box(x, y, 450, 255));
  overviewFilters.push(draw(`${String(i + 1).padStart(2, "0")} · ${lunarLabel(row.month)}`, x + 28, y + 52, 32));
  overviewFilters.push(draw(`Mùng 1 ${short(row.mùng1)}`, x + 28, y + 120, 24, "5a4f44"));
  overviewFilters.push(draw(`Rằm ${short(row.rằm)}`, x + 28, y + 170, 24, "5a4f44"));
});
run(overviewBg, path.join(outDir, "calendar-2027-overview.webp"), overviewFilters);
