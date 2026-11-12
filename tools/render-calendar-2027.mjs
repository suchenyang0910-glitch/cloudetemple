#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { lunarToSolar, solarToLunar } from "../server/lunar-hnd.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const spec = JSON.parse(fs.readFileSync(path.join(root, "tools/calendar-2027-dates.json"), "utf8"));
const iso = ({ day, month, year }) => `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
const calculated = spec.expected.map((row) => ({
  ...row,
  mùng1: iso(lunarToSolar({ day: 1, month: row.month, year: spec.year })),
  rằm: iso(lunarToSolar({ day: 15, month: row.month, year: spec.year }))
}));
for (let i = 0; i < calculated.length; i += 1) {
  for (const key of ["mùng1", "rằm"]) {
    if (calculated[i][key] !== spec.expected[i][key]) {
      throw new Error(`date assertion failed: month ${i + 1} ${key} expected ${spec.expected[i][key]} got ${calculated[i][key]}`);
    }
  }
}
console.log(`ASSERT 2027 UTC+7: ${calculated.length * 2}/${calculated.length * 2} dates match Hồ Ngọc Đức algorithm`);

const bg = path.join(root, "review/p34-calendar/calendar-2027-feb-background.webp");
const overviewBg = path.join(root, "review/p34-calendar/calendar-2027-overview-background.webp");
const outDir = path.join(root, "review/p34-calendar");
const font = "C:/Windows/Fonts/NotoSansSC-VF.ttf";
const esc = (s) => s.replaceAll("\\", "\\\\").replaceAll(":", "\\:").replaceAll("'", "\\'");
const draw = (text, x, y, size, color = "38453f", box = true) => `drawtext=fontfile='C\\:/Windows/Fonts/NotoSansSC-VF.ttf':text='${esc(text)}':x=${x}:y=${y}:fontsize=${size}:fontcolor=${color}${box ? ":box=1:boxcolor=f7f1e7@0.82:boxborderw=8" : ""}`;
const run = (input, output, filters) => {
  const result = spawnSync("ffmpeg", ["-y", "-i", input, "-vf", filters.join(","), "-frames:v", "1", "-c:v", "libwebp", "-q:v", "78", output], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || `ffmpeg failed for ${output}`);
};
const label = (month) => month === 1 ? "Tháng Giêng" : month === 12 ? "Tháng Chạp" : `Tháng ${month} ÂL`;
const short = (date) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;
const daysInMonth = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate();
const mondayIndex = (year, month, day) => (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
const box = (x, y, w, h, color = "f7f1e7@0.92", radius = 0) => `drawbox=x=${x}:y=${y}:w=${w}:h=${h}:color=${color}:t=fill${radius ? `,drawbox=x=${x + 2}:y=${y + 2}:w=${w - 4}:h=${h - 4}:color=${color}:t=fill` : ""}`;
const renderMonth = (month, outputName) => {
  const expectedMonth = outputName.includes("feb") ? 2 : outputName.includes("sep") ? 9 : 10;
  if (month !== expectedMonth) throw new Error(`month/file assertion failed: ${outputName} expects ${expectedMonth}, got ${month}`);
  const firstDate = `${spec.year}-${String(month).padStart(2, "0")}-01`;
  const expectedWeekday = { 2: 0, 9: 2, 10: 4 }[month];
  if (mondayIndex(spec.year, month, 1) !== expectedWeekday) throw new Error(`weekday assertion failed for ${firstDate}`);
  const filters = [box(35, 420, 1010, 1330), draw(`${label(month)} · 2027`, 70, 450, 72, "25352f")];
  const first = mondayIndex(spec.year, month, 1);
  const count = daysInMonth(spec.year, month);
  const cellW = 142, cellH = 185, left = 45, top = 565;
  const weekdays = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
  weekdays.forEach((name, col) => filters.push(draw(name, left + col * cellW + 48, top, 28, "25352f", false)));
  for (let day = 1; day <= count; day += 1) {
    const slot = first + day - 1;
    const col = slot % 7, row = Math.floor(slot / 7);
    const x = left + col * cellW, y = top + row * cellH;
    const lunar = solarToLunar({ day, month, year: spec.year });
    const marked = lunar.day === 1 || lunar.day === 15;
    if (marked) filters.push(box(x + 4, y + 34, cellW - 8, 100, lunar.day === 1 ? "e9d3b8@0.95" : "eadcae@0.95"));
    filters.push(draw(String(day), x + 50, y + 42, 44, marked ? "7b3028" : "25352f", false));
    filters.push(draw(`ÂL ${lunar.day}/${lunar.month}`, x + 18, y + 98, 24, marked ? "7b3028" : "25352f", false));
    if (marked) filters.push(draw(lunar.day === 1 ? "Mùng 1" : "Rằm", x + 18, y + 130, 21, "7b3028", false));
    if (month === 2 && day === 6) filters.push(draw("Tết", x + 78, y + 130, 21, "7b3028", false));
    if (month === 9 && day === 15) filters.push(draw("Trung Thu", x + 18, y + 156, 20, "7b3028", false));
  }
  run(bg, path.join(outDir, outputName), filters);
};
renderMonth(2, "calendar-2027-feb.webp");
renderMonth(9, "calendar-2027-sep.webp");
renderMonth(10, "calendar-2027-oct.webp");
const overviewFilters = [draw("CHÙA MÂY · LỊCH 2027", 100, 70, 56, "25352f")];
calculated.forEach((row, i) => {
  const x = 90 + (i % 4) * 490;
  const y = 205 + Math.floor(i / 4) * 390;
  overviewFilters.push(box(x, y, 450, 320));
  overviewFilters.push(draw(`${String(i + 1).padStart(2, "0")} · ${label(row.month)}`, x + 28, y + 52, 32, "25352f", false));
  overviewFilters.push(draw(`Mùng 1 ${short(row.mùng1)}`, x + 28, y + 120, 24, "25352f", false));
  overviewFilters.push(draw(`Rằm ${short(row.rằm)}`, x + 28, y + 170, 24, "25352f", false));
});
run(overviewBg, path.join(outDir, "calendar-2027-overview.webp"), overviewFilters);
