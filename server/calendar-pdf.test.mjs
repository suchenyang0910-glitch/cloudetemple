import test from "node:test";
import assert from "node:assert/strict";
import { buildFamilyCalendarModel, normalizeCalendarFamilyName } from "./calendar-pdf.mjs";

const tablets = [
  { honorific: "Bà ngoại", full_name: "Tên riêng không được xuất hiện", death_lunar_day: 12, death_lunar_month: 3, death_lunar_leap: 0 },
  { honorific: "Ông nội", full_name: "Một tên riêng khác", death_lunar_day: 15, death_lunar_month: 7, death_lunar_leap: 0 },
  { honorific: "Bác cả", full_name: "Tên tháng nhuận", death_lunar_day: 5, death_lunar_month: 5, death_lunar_leap: 1 },
];

test("2027 family calendar has 12 complete Gregorian grids and Vietnamese lunar labels", () => {
  const model = buildFamilyCalendarModel({ familyName: "Gia đình họ Nguyễn", tablets, year: 2027 });
  assert.equal(model.months.length, 12);
  assert.equal(model.months.reduce((sum, month) => sum + month.cells.filter(Boolean).length, 0), 365);
  assert.ok(model.months.every((month) => month.cells.length % 7 === 0));
  assert.equal(model.months[0].cells.find(Boolean).solarDay, 1);
  assert.match(model.months[0].cells.find(Boolean).lunar, /^\d+\/\d+/);
  assert.equal(model.yearName, "Năm Đinh Mùi");
});

test("calendar model contains honorific memorial labels but excludes tablet names", () => {
  const serialized = JSON.stringify(buildFamilyCalendarModel({ familyName: "Gia đình họ Nguyễn", tablets, year: 2027 }));
  assert.match(serialized, /Giỗ Bà ngoại/);
  assert.match(serialized, /Giỗ Ông nội/);
  assert.match(serialized, /Giỗ Bác cả/);
  for (const tablet of tablets) assert.doesNotMatch(serialized, new RegExp(tablet.full_name));
});

test("calendar inputs are bounded and 2027-only for the review candidate", () => {
  assert.equal(normalizeCalendarFamilyName("  Gia đình họ Nguyễn  "), "Gia đình họ Nguyễn");
  assert.throws(() => normalizeCalendarFamilyName("<>"), /invalid_family_name/);
  assert.throws(() => buildFamilyCalendarModel({ familyName: "Gia đình mẫu", tablets, year: 2028 }), /invalid_calendar_year/);
});
