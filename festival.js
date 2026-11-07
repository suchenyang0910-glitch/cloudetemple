// festival.js — Tết 2027 festival layer
// All dates expressed as Vietnam local date strings "YYYY-MM-DD" (UTC+7).

const FLOWER_KEY = 'ct-flower-pref';
export const readFlower = () => { try { return localStorage.getItem(FLOWER_KEY) || 'hoa-mai'; } catch { return 'hoa-mai'; } };
export const writeFlower = v => { try { localStorage.setItem(FLOWER_KEY, v); } catch {} };

// Festival periods. `id` becomes body[data-festival] and drives CSS decoration.
const PERIODS = [
  { id: 'ong-tao',  start: '2027-01-30', end: '2027-01-30', lanterns: 3 },
  { id: 'tat-nien', start: '2027-02-05', end: '2027-02-05', lanterns: 6 },
  { id: 'mung1',    start: '2027-02-06', end: '2027-02-06', lanterns: 8 },
  { id: 'mung2',    start: '2027-02-07', end: '2027-02-07', lanterns: 7 },
  { id: 'mung3',    start: '2027-02-08', end: '2027-02-08', lanterns: 4 },
  { id: 'ram',      start: '2027-02-20', end: '2027-02-20', lanterns: 5, moon: true },
];

export function vnDay(now = Date.now()) {
  return new Date(now + 7 * 3600000).toISOString().slice(0, 10);
}

export function getFestivalPeriod(now) {
  // Staging preview override: ?festival-date=YYYY-MM-DD
  let day;
  try {
    const isStaging = typeof location !== 'undefined' && ['staging.chuamay.org','localhost','127.0.0.1'].includes(location.hostname);
    if (isStaging) {
      const param = new URLSearchParams(location.search).get('festival-date');
      if (param && /^\d{4}-\d{2}-\d{2}$/.test(param)) day = param;
    }
  } catch {}
  if (!day) day = vnDay(now);
  return PERIODS.find(p => day >= p.start && day <= p.end) ?? null;
}

// New Year bell schedule (UTC ms).
// 2027-02-05 23:55–23:59 VN = 16:55–16:59 UTC
// 2027-02-06 00:00 VN       = 2027-02-05 17:00:00 UTC
const BELL_SCHEDULE = [
  { ts: Date.UTC(2027, 1, 5, 16, 55), count: 1, newYear: false },
  { ts: Date.UTC(2027, 1, 5, 16, 56), count: 1, newYear: false },
  { ts: Date.UTC(2027, 1, 5, 16, 57), count: 1, newYear: false },
  { ts: Date.UTC(2027, 1, 5, 16, 58), count: 1, newYear: false },
  { ts: Date.UTC(2027, 1, 5, 16, 59), count: 1, newYear: false },
  { ts: Date.UTC(2027, 1, 5, 17,  0), count: 12, newYear: true },
];
// Only arm if within 48 hours of the first bell.
const ARM_WINDOW = 48 * 3600000;

export function createNewYearBell({ onBell, onNewYear }) {
  let timers = [];
  let armed = false;

  const schedule = (entry, cb) => {
    const delay = entry.ts - Date.now();
    if (delay < 0 || delay > ARM_WINDOW) return;
    timers.push(setTimeout(cb, delay));
  };

  return {
    arm(hasInteracted) {
      if (armed || !hasInteracted) return;
      armed = true;
      for (const entry of BELL_SCHEDULE) {
        schedule(entry, () => entry.newYear ? onNewYear(entry.count) : onBell(entry.count));
      }
    },
    disarm() { timers.forEach(clearTimeout); timers = []; armed = false; },
    isArmed() { return armed; },
  };
}

// Forbidden word check for festival share card copy.
// Source: T4 §5 cultural risk checklist.
const FORBIDDEN = [
  /bảo\s*hộ/i, /tích\s*phước/i, /giải\s*hạn/i, /phù\s*hộ/i, /tiêu\s*tai/i,
  /công\s*đức/i, /hòm\s*công\s*đức/i, /保佑/, /积功德/, /消灾/, /祈福有效/, /功德箱/, /功德圆满/,
];
export function hasForbiddenWord(text) {
  return FORBIDDEN.some(re => re.test(text));
}
