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
const renderMonth = (month, outputName) => {
  const filters = [draw(`${month === 2 ? "Tháng 2" : month === 9 ? "Tháng 9" : "Tháng 10"} · 2027`, 70, 470, 44, "713844"), draw("Thứ Hai · Thứ Ba · Thứ Tư · Thứ Năm · Thứ Sáu · Thứ Bảy · Chủ Nhật", 70, 550, 22, "38453f")];
  const first = mondayIndex(spec.year, month, 1);
  const count = daysInMonth(spec.year, month);
  const cellW = 136, cellH = 170, left = 55, top = 610;
  for (let day = 1; day <= count; day += 1) {
    const slot = first + day - 1;
    const col = slot % 7, row = Math.floor(slot / 7);
    const x = left + col * cellW, y = top + row * cellH;
    const lunar = solarToLunar({ day, month, year: spec.year });
    const color = lunar.day === 1 || lunar.day === 15 ? "9b5c54" : "38453f";
    filters.push(draw(String(day), x + 12, y, 26, color));
    filters.push(draw(`ÂL ${lunar.day}/${lunar.month}`, x + 12, y + 42, 18, color, false));
    if (lunar.day === 1 || lunar.day === 15) filters.push(draw(lunar.day === 1 ? "Mùng 1" : "Rằm", x + 12, y + 78, 17, "9b5c54"));
    if (month === 2 && day === 6) filters.push(draw("Tết", x + 12, y + 112, 17, "9b5c54"));
    if (month === 9 && day === 15) filters.push(draw("Trung Thu", x + 12, y + 112, 17, "9b5c54"));
  }
  run(bg, path.join(outDir, outputName), filters);
};
renderMonth(1, "calendar-2027-feb.webp");
renderMonth(9, "calendar-2027-sep.webp");
renderMonth(10, "calendar-2027-oct.webp");
const overviewFilters = [draw("CHÙA MÂY · LỊCH 2027", 110, 90, 48, "713844")];
calculated.forEach((row, i) => {
  const x = 120 + (i % 4) * 490;
  const y = 260 + Math.floor(i / 4) * 300;
  overviewFilters.push(draw(`${String(i + 1).padStart(2, "0")} · ${label(row.month)}`, x, y, 30));
  overviewFilters.push(draw(`Mùng 1 ${short(row.mùng1)} · Rằm ${short(row.rằm)}`, x, y + 58, 22));
});
run(overviewBg, path.join(outDir, "calendar-2027-overview.webp"), overviewFilters);
