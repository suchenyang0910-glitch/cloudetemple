import test from "node:test";
import assert from "node:assert/strict";
import { lunarToSolar, solarToLunar, qingmingDate } from "./lunar-hnd.mjs";
test("fixed externally checked Vietnamese examples", () => {
  assert.deepEqual(lunarToSolar({ day: 1, month: 1, year: 2026 }), {
    day: 17,
    month: 2,
    year: 2026,
  });
  assert.deepEqual(lunarToSolar({ day: 15, month: 7, year: 2026 }), {
    day: 27,
    month: 8,
    year: 2026,
  });
  assert.deepEqual(qingmingDate(2026), { day: 5, month: 4, year: 2026 });
  assert.deepEqual(lunarToSolar({ day: 12, month: 3, year: 2027 }), {
    day: 18,
    month: 4,
    year: 2027,
  });
});
test("algorithm regression forecasts cover Tết and Vu Lan through 2030", () => {
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
test("algorithm regression forecasts cover Qingming through 2030", () => {
  for (const [year, day] of [
    [2026, 5],
    [2027, 5],
    [2028, 4],
    [2029, 4],
    [2030, 5],
  ])
    assert.deepEqual(qingmingDate(year), { day, month: 4, year });
});
test("61 month starts match independently checked Vietnamese GMT+7 tables", () => {
  const fixtures = [
    [2026,1,0,17,2,2026],[2026,2,0,19,3,2026],[2026,3,0,17,4,2026],[2026,4,0,17,5,2026],
    [2026,5,0,15,6,2026],[2026,6,0,14,7,2026],[2026,7,0,13,8,2026],[2026,8,0,11,9,2026],
    [2026,9,0,10,10,2026],[2026,10,0,9,11,2026],[2026,11,0,9,12,2026],[2026,12,0,8,1,2027],
    [2027,1,0,6,2,2027],[2027,2,0,8,3,2027],[2027,3,0,7,4,2027],[2027,4,0,6,5,2027],
    [2027,5,0,5,6,2027],[2027,6,0,4,7,2027],[2027,7,0,2,8,2027],[2027,8,0,1,9,2027],
    [2027,9,0,30,9,2027],[2027,10,0,29,10,2027],[2027,11,0,28,11,2027],[2027,12,0,28,12,2027],
    [2028,1,0,26,1,2028],[2028,2,0,25,2,2028],[2028,3,0,26,3,2028],[2028,4,0,25,4,2028],
    [2028,5,0,24,5,2028],[2028,5,1,23,6,2028],[2028,6,0,22,7,2028],[2028,7,0,20,8,2028],
    [2028,8,0,19,9,2028],[2028,9,0,18,10,2028],[2028,10,0,16,11,2028],[2028,11,0,16,12,2028],
    [2028,12,0,15,1,2029],[2029,1,0,13,2,2029],[2029,2,0,15,3,2029],[2029,3,0,14,4,2029],
    [2029,4,0,13,5,2029],[2029,5,0,12,6,2029],[2029,6,0,11,7,2029],[2029,7,0,10,8,2029],
    [2029,8,0,8,9,2029],[2029,9,0,8,10,2029],[2029,10,0,6,11,2029],[2029,11,0,5,12,2029],
    [2029,12,0,4,1,2030],[2030,1,0,2,2,2030],[2030,2,0,4,3,2030],[2030,3,0,3,4,2030],
    [2030,4,0,2,5,2030],[2030,5,0,1,6,2030],[2030,6,0,1,7,2030],[2030,7,0,30,7,2030],
    [2030,8,0,29,8,2030],[2030,9,0,27,9,2030],[2030,10,0,27,10,2030],[2030,11,0,25,11,2030],
    [2030,12,0,25,12,2030],
  ];
  assert.equal(fixtures.length, 61);
  for (const [year, month, leap, day, solarMonth, solarYear] of fixtures)
    assert.deepEqual(lunarToSolar({ day: 1, month, year, leap: Boolean(leap) }), {
      day,
      month: solarMonth,
      year: solarYear,
    });
});
test("all 2027 new moon and full moon dates match the reviewed UTC+7 calendar", () => {
  const expected = [
    [8,1,1,12],[22,1,15,12],[6,2,1,1],[20,2,15,1],[8,3,1,2],[22,3,15,2],
    [7,4,1,3],[21,4,15,3],[6,5,1,4],[20,5,15,4],[5,6,1,5],[19,6,15,5],
    [4,7,1,6],[18,7,15,6],[2,8,1,7],[16,8,15,7],[1,9,1,8],[15,9,15,8],
    [30,9,1,9],[14,10,15,9],[29,10,1,10],[12,11,15,10],[28,11,1,11],
    [12,12,15,11],[28,12,1,12],
  ];
  const actual = [];
  for (let month = 1; month <= 12; month++)
    for (let day = 1; day <= new Date(Date.UTC(2027, month, 0)).getUTCDate(); day++) {
      const lunar = solarToLunar({ day, month, year: 2027 });
      if (lunar.day === 1 || lunar.day === 15) actual.push([day, month, lunar.day, lunar.month]);
    }
  assert.deepEqual(actual, expected);
});
test("20 deterministic round trips are internal consistency checks only", () => {
  for (let i = 0; i < 20; i++) {
    const year = 2026 + (i % 5),
      month = 1 + ((i * 7) % 12),
      day = 1 + ((i * 11) % 24),
      solar = { day, month, year },
      lunar = solarToLunar(solar);
    assert.deepEqual(lunarToSolar(lunar), solar);
  }
});
