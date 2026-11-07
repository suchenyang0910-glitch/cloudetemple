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
  assert.equal(model.months[0].yearName, "Năm Bính Ngọ");
  assert.equal(model.months[1].yearName, "Bính Ngọ → Đinh Mùi (từ 6/2)");
  assert.ok(model.months.slice(2).every((month) => month.yearName === "Năm Đinh Mùi"));
  assert.doesNotMatch(JSON.stringify(model), /chờ người bản ngữ duyệt/);
});

test("calendar model contains honorific memorial labels but excludes tablet names", () => {
  const model = buildFamilyCalendarModel({ familyName: "Gia đình họ Nguyễn", tablets, year: 2027 }),
    events = model.months.flatMap((month) => month.cells.filter(Boolean).flatMap((cell) => cell.events)),
    serialized = JSON.stringify(model);
  assert.match(serialized, /Giỗ Bà ngoại/);
  assert.match(serialized, /Giỗ Ông nội/);
  assert.match(serialized, /Giỗ Bác cả/);
  assert.equal(events.find((event) => event.label === "Giỗ Bà ngoại")?.kind, "memorial");
  assert.equal(events.find((event) => event.label === "Giỗ Tổ Hùng Vương")?.kind, "festival");
  assert.deepEqual(model.months[3].memorials, [{ solarDay: 18, lunar: "12/3", label: "Giỗ Bà ngoại" }]);
  assert.equal(model.brand, "CHÙA MÂY · CLOUD TEMPLE");
  assert.match(model.blessing, /Gìn giữ ký ức gia đình/);
  for (const tablet of tablets) assert.doesNotMatch(serialized, new RegExp(tablet.full_name));
});

test("national holidays are separate gray festival events", () => {
  const model = buildFamilyCalendarModel({ familyName: "Gia đình họ Nguyễn", tablets, year: 2027 });
  for (const [month, day, label] of [
    [1, 1, "Tết Dương lịch"],
    [4, 16, "Giỗ Tổ Hùng Vương"],
    [4, 30, "Ngày Giải phóng miền Nam"],
    [5, 1, "Ngày Quốc tế Lao động"],
    [9, 2, "Quốc khánh"],
  ]) {
    const cell = model.months[month - 1].cells.find((entry) => entry?.solarDay === day),
      event = cell.events.find((entry) => entry.label === label);
    assert.equal(event?.kind, "festival", `${day}/${month} ${label}`);
  }
});

test("calendar inputs are bounded and 2027-only for the review candidate", () => {
  assert.equal(normalizeCalendarFamilyName("  Gia đình họ Nguyễn  "), "Gia đình họ Nguyễn");
  assert.throws(() => normalizeCalendarFamilyName("<>"), /invalid_family_name/);
  assert.throws(() => buildFamilyCalendarModel({ familyName: "Gia đình mẫu", tablets, year: 2028 }), /invalid_calendar_year/);
});
