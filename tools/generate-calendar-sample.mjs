import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createFamilyCalendarPdf } from "../server/calendar-pdf.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  outDir = path.join(root, "review", "calendar"),
  output = path.join(outDir, "mau-lich-ngay-gio-gia-dinh-nguyen-2027-v3.1.pdf"),
  tablets = [
    { honorific: "Bà ngoại", full_name: "Nguyễn Thị Lan", death_lunar_day: 12, death_lunar_month: 3, death_lunar_leap: 0 },
    { honorific: "Ông nội", full_name: "Nguyễn Văn Bình", death_lunar_day: 15, death_lunar_month: 7, death_lunar_leap: 0 },
    { honorific: "Bác cả", full_name: "Nguyễn Văn Minh", death_lunar_day: 5, death_lunar_month: 5, death_lunar_leap: 1 },
  ];

await mkdir(outDir, { recursive: true });
const pdf = await createFamilyCalendarPdf(
  { familyName: "Gia đình họ Nguyễn", tablets, year: 2027, leapRule: "regular-month" },
  { python: process.env.CALENDAR_PYTHON },
);
await writeFile(output, pdf);
console.log(output);
