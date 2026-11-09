// Festival calendar lookup — Làng Chùa backend
// Copy to E:\cloudtemple\server\festival.mjs
// Reads data/festival-calendar.json relative to the cloudtemple root.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');

// Load calendar from disk once at startup. Returns {} on missing/corrupt file.
export function loadCalendar(dir = DATA_DIR) {
  try {
    return JSON.parse(readFileSync(join(dir, 'festival-calendar.json'), 'utf8'));
  } catch {
    return {};
  }
}

// Find the entry whose [start, end] window contains dateStr ("YYYY-MM-DD").
export function lookupFestival(calendar, dateStr) {
  const year = dateStr.slice(0, 4);
  const entries = calendar[year] ?? [];
  return entries.find(e => dateStr >= e.start && dateStr <= e.end) ?? null;
}

// Today's date string in Vietnam Standard Time (UTC+7).
// Optional `now` (Unix ms) accepted for testing; omit in production.
export function festivalToday(now = Date.now()) {
  return new Date(now + 7 * 3_600_000).toISOString().slice(0, 10);
}

// Unix milliseconds for the next UTC+7 midnight — used as Cache-Control horizon.
// Optional `now` (Unix ms) accepted for testing; omit in production.
export function festivalMidnightMs(now = Date.now()) {
  const off = 7 * 3_600_000;
  const vnNow = now + off;
  // Start of today in virtual VN space → add one day → subtract offset back
  return vnNow - (vnNow % 86_400_000) + 86_400_000 - off;
}
