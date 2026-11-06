import test from "node:test";
import assert from "node:assert/strict";
import { lunarToSolar, solarToLunar, qingmingDate } from "./lunar-hnd.mjs";
test("Vietnamese Tet 2026-2029 matches published calendars", () => {
  for (const [year, day, month] of [
    [2026, 17, 2],
    [2027, 6, 2],
    [2028, 26, 1],
    [2029, 13, 2],
  ])
    assert.deepEqual(lunarToSolar({ day: 1, month: 1, year }), {
      day,
      month,
      year,
    });
});
test("Hồ Ngọc Đức UTC+7 fixtures cover Tết and Vu Lan through 2030", () => {
  const fixtures = [
    [2026, [17, 2], [27, 8]],
    [2027, [6, 2], [16, 8]],
    [2028, [26, 1], [3, 9]],
    [2029, [13, 2], [24, 8]],
    [2030, [2, 2], [13, 8]],
  ];
  for (const [year, tet, vuLan] of fixtures) {
    assert.deepEqual(lunarToSolar({ day: 1, month: 1, year }), {
      day: tet[0],
      month: tet[1],
      year,
    });
    assert.deepEqual(lunarToSolar({ day: 15, month: 7, year }), {
      day: vuLan[0],
      month: vuLan[1],
      year,
    });
  }
});
test("Qingming solar term is calculated at UTC+7 for 2026-2030", () => {
  for (const [year, day] of [
    [2026, 5],
    [2027, 5],
    [2028, 4],
    [2029, 4],
    [2030, 5],
  ]) assert.deepEqual(qingmingDate(year), { day, month: 4, year });
});
test("Vu Lan 2026 and review date match checked Vietnamese dates", () => {
  assert.deepEqual(lunarToSolar({ day: 15, month: 7, year: 2026 }), {
    day: 27,
    month: 8,
    year: 2026,
  });
  assert.deepEqual(lunarToSolar({ day: 12, month: 3, year: 2027 }), {
    day: 18,
    month: 4,
    year: 2027,
  });
});
test("20 deterministic dates round-trip at UTC+7", () => {
  for (let i = 0; i < 20; i++) {
    const year = 2026 + (i % 5),
      month = 1 + ((i * 7) % 12),
      day = 1 + ((i * 11) % 24),
      solar = { day, month, year },
      lunar = solarToLunar(solar);
    assert.deepEqual(lunarToSolar(lunar), solar);
  }
});
