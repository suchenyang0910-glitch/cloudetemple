// Festival activation system 鈥?doc: 10-festival-schedule-system.md

const TET_FESTIVALS = ['ong-tao', 'tat-nien', 'mung1', 'mung2', 'mung3', 'ram'];

function getNowVN() {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utcMs + 7 * 3600_000);
}

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

async function loadCalendar() {
  const r = await fetch('./data/festival-calendar.json');
  return r.json();
}

function matchFestival(calendar, dateStr) {
  const year = dateStr.slice(0, 4);
  const entries = calendar[year] ?? [];
  return entries.find(e => dateStr >= e.start && dateStr <= e.end) ?? null;
}

export async function initFestival() {
  const dateStr = toDateStr(getNowVN());
  let entry = null;

  // Primary: server
  try {
    const r = await fetch('/api/festival/current');
    if (r.ok) {
      const data = await r.json();
      entry = { festival: data.festival, temple: data.temple_highlight };
    }
  } catch { /* fall through to local calendar */ }

  // Fallback: local calendar
  if (!entry) {
    try {
      const cal = await loadCalendar();
      entry = matchFestival(cal, dateStr);
    } catch { entry = null; }
  }

  const festival = entry?.festival ?? '';
  const highlight = entry?.temple ?? '';
  document.body.dataset.festival = festival;
  return { festival, highlight };
}

export function canShowGreetingCard() {
  return TET_FESTIVALS.includes(document.body.dataset.festival);
}

