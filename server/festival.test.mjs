// Tests for festival.mjs — copy to E:\cloudtemple\server\festival.test.mjs
// Run: node --test festival.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadCalendar, lookupFestival, festivalToday, festivalMidnightMs } from './festival.mjs';

// ── festivalToday ─────────────────────────────────────────────────────────────
// All UTC timestamps chosen at known VN-timezone boundaries.

test('festivalToday: 1 ms before VN midnight returns previous date', () => {
  // 2027-02-05T16:59:59.999Z = 2027-02-05T23:59:59.999+07:00  (last ms of Tất Niên)
  assert.equal(festivalToday(Date.UTC(2027, 1, 5, 16, 59, 59, 999)), '2027-02-05');
});

test('festivalToday: exact VN midnight returns new date', () => {
  // 2027-02-05T17:00:00.000Z = 2027-02-06T00:00:00.000+07:00  (first ms of Mùng 1)
  assert.equal(festivalToday(Date.UTC(2027, 1, 5, 17, 0, 0, 0)), '2027-02-06');
});

test('festivalToday: month-end rollover Jan→Feb', () => {
  // 2027-01-31T17:00:00Z = 2027-02-01T00:00:00+07:00
  assert.equal(festivalToday(Date.UTC(2027, 0, 31, 17, 0, 0)), '2027-02-01');
});

test('festivalToday: year-end rollover Dec→Jan', () => {
  // 2026-12-31T17:00:00Z = 2027-01-01T00:00:00+07:00
  assert.equal(festivalToday(Date.UTC(2026, 11, 31, 17, 0, 0)), '2027-01-01');
});

// ── festivalMidnightMs ────────────────────────────────────────────────────────

test('festivalMidnightMs: midday UTC → returns that night\'s VN midnight', () => {
  // now = 2027-02-06T12:00Z (Mùng 1, 19:00 VN)
  // next VN midnight = 2027-02-07T00:00+07:00 = 2027-02-06T17:00Z
  const now = Date.UTC(2027, 1, 6, 12, 0, 0);
  assert.equal(festivalMidnightMs(now), Date.UTC(2027, 1, 6, 17, 0, 0));
});

test('festivalMidnightMs: exact VN midnight → returns next night\'s VN midnight', () => {
  // now = 2027-02-05T17:00Z = exactly midnight Feb 6 VN
  // next VN midnight = 2027-02-07T00:00+07:00 = 2027-02-06T17:00Z
  const now = Date.UTC(2027, 1, 5, 17, 0, 0);
  assert.equal(festivalMidnightMs(now), Date.UTC(2027, 1, 6, 17, 0, 0));
});

test('festivalMidnightMs: month-end rollover Feb→Mar', () => {
  // now = 2027-02-28T12:00Z (19:00 VN)
  // next VN midnight = 2027-03-01T00:00+07:00 = 2027-02-28T17:00Z
  const now = Date.UTC(2027, 1, 28, 12, 0, 0);
  assert.equal(festivalMidnightMs(now), Date.UTC(2027, 1, 28, 17, 0, 0));
});

test('festivalMidnightMs: result is strictly greater than now', () => {
  const now = Date.UTC(2027, 1, 6, 10, 30, 0);
  assert.ok(festivalMidnightMs(now) > now);
});

test('festivalMidnightMs: TTL is at most 86400 seconds', () => {
  const now = Date.UTC(2027, 1, 6, 10, 30, 0);
  assert.ok((festivalMidnightMs(now) - now) <= 86_400_000);
});

// ── lookupFestival ────────────────────────────────────────────────────────────

const CAL = {
  '2027': [
    { festival: 'ong-tao', temple: 'chuamay', start: '2027-01-29', end: '2027-01-29' },
    { festival: 'mung1',   temple: 'dilac',   start: '2027-02-06', end: '2027-02-06' },
    { festival: 'mung2',   temple: 'dilac',   start: '2027-02-07', end: '2027-02-07' },
  ],
};

test('lookupFestival: exact match returns entry', () => {
  const e = lookupFestival(CAL, '2027-02-06');
  assert.equal(e?.festival, 'mung1');
  assert.equal(e?.temple, 'dilac');
});

test('lookupFestival: day before any entry returns null', () => {
  assert.equal(lookupFestival(CAL, '2027-02-05'), null);
});

test('lookupFestival: gap between entries returns null', () => {
  // 2027-01-30 is between ong-tao (01-29) and mung1 (02-06)
  assert.equal(lookupFestival(CAL, '2027-01-30'), null);
});

test('lookupFestival: day after last entry returns null', () => {
  assert.equal(lookupFestival(CAL, '2027-02-08'), null);
});

test('lookupFestival: returns first matching entry when multiple exist', () => {
  const e = lookupFestival(CAL, '2027-01-29');
  assert.equal(e?.festival, 'ong-tao');
});

test('lookupFestival: year not in calendar returns null', () => {
  assert.equal(lookupFestival(CAL, '2025-02-06'), null);
});

test('lookupFestival: empty calendar returns null', () => {
  assert.equal(lookupFestival({}, '2027-02-06'), null);
});

test('lookupFestival: multi-day range — start boundary matches', () => {
  const cal = { '2027': [{ festival: 'ram', temple: 'chuamay', start: '2027-02-20', end: '2027-02-21' }] };
  assert.equal(lookupFestival(cal, '2027-02-20')?.festival, 'ram');
});

test('lookupFestival: multi-day range — end boundary matches', () => {
  const cal = { '2027': [{ festival: 'ram', temple: 'chuamay', start: '2027-02-20', end: '2027-02-21' }] };
  assert.equal(lookupFestival(cal, '2027-02-21')?.festival, 'ram');
});

test('lookupFestival: multi-day range — day after end returns null', () => {
  const cal = { '2027': [{ festival: 'ram', temple: 'chuamay', start: '2027-02-20', end: '2027-02-21' }] };
  assert.equal(lookupFestival(cal, '2027-02-22'), null);
});

// ── loadCalendar ──────────────────────────────────────────────────────────────

test('loadCalendar: missing file returns {}', () => {
  assert.deepEqual(loadCalendar('/nonexistent/path/no/file/here'), {});
});

test('loadCalendar: corrupt JSON returns {}', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lc-fest-'));
  try {
    await writeFile(join(dir, 'festival-calendar.json'), '{ not valid json {{');
    assert.deepEqual(loadCalendar(dir), {});
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loadCalendar: valid JSON is parsed and returned', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lc-fest-'));
  try {
    const data = { '2027': [{ festival: 'mung1', temple: 'dilac', start: '2027-02-06', end: '2027-02-06' }] };
    await writeFile(join(dir, 'festival-calendar.json'), JSON.stringify(data));
    assert.deepEqual(loadCalendar(dir), data);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loadCalendar: empty JSON object returns {}', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lc-fest-'));
  try {
    await writeFile(join(dir, 'festival-calendar.json'), '{}');
    assert.deepEqual(loadCalendar(dir), {});
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
