#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { lunarToSolar } from "../server/lunar-hnd.mjs";

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
const font = "C:/Windows/Fonts/arial.ttf";
const esc = (s) => s.replaceAll("\\", "\\\\").replaceAll(":", "\\:").replaceAll("'", "\\'");
const draw = (text, x, y, size, color = "38453f") => `drawtext=fontfile='C\\:/Windows/Fonts/arial.ttf':text='${esc(text)}':x=${x}:y=${y}:fontsize=${size}:fontcolor=${color}:box=1:boxcolor=f7f1e7@0.82:boxborderw=8`;
const run = (input, output, filters) => {
  const result = spawnSync("ffmpeg", ["-y", "-i", input, "-vf", filters.join(","), "-frames:v", "1", "-c:v", "libwebp", "-q:v", "78", output], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || `ffmpeg failed for ${output}`);
};
const label = (month) => month === 1 ? "Tháng Giêng" : month === 12 ? "Tháng Chạp" : `Tháng ${month}`;
const short = (date) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;
const renderMonth = (month, outputName) => {
  const row = calculated[month - 1];
  run(bg, path.join(outDir, outputName), [
    draw(`${label(month)} · 2027`, 80, 820, 52, "713844"),
    draw(`Mùng 1: ${short(row.mùng1)} · Rằm: ${short(row.rằm)}`, 80, 900, 30),
    ...(month === 1 ? [draw(`Tết Đinh Mùi · Mùng 1 Tết ${short(row.mùng1)}`, 80, 970, 30, "9b5c54")] : [])
  ]);
};
renderMonth(1, "calendar-2027-feb.webp");
renderMonth(9, "calendar-2027-sep.webp");
renderMonth(10, "calendar-2027-oct.webp");
const overviewFilters = [draw("CHÙA MÂY · LỊCH 2027 · UTC+7", 110, 90, 48, "713844")];
calculated.forEach((row, i) => {
  const x = 120 + (i % 4) * 490;
  const y = 260 + Math.floor(i / 4) * 300;
  overviewFilters.push(draw(`${String(i + 1).padStart(2, "0")} · ${label(row.month)}`, x, y, 27));
  overviewFilters.push(draw(`Mùng 1 ${short(row.mùng1)} · Rằm ${short(row.rằm)}`, x, y + 52, 21));
});
run(overviewBg, path.join(outDir, "calendar-2027-overview.webp"), overviewFilters);
