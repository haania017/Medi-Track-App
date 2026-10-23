/**
 * Timezone helpers built on Intl (no external tz database needed).
 * All functions are pure and safe to unit-test.
 */

const partsFormatterCache = new Map();

function partsFormatter(timeZone) {
  if (!partsFormatterCache.has(timeZone)) {
    partsFormatterCache.set(
      timeZone,
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    );
  }
  return partsFormatterCache.get(timeZone);
}

export function isValidTimeZone(timeZone) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Local wall-clock parts for an instant in a given timezone. */
export function zonedParts(date, timeZone) {
  const parts = partsFormatter(timeZone).formatToParts(date);
  const map = {};
  for (const p of parts) if (p.type !== 'literal') map[p.type] = p.value;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour) % 24,
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

/** Offset (local − UTC) in milliseconds for an instant in a timezone. */
export function tzOffsetMs(date, timeZone) {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** "YYYY-MM-DD" for an instant in a timezone. */
export function localDateString(date, timeZone) {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** "HH:mm" for an instant in a timezone. */
export function localTimeString(date, timeZone) {
  const p = zonedParts(date, timeZone);
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

/**
 * Convert a local wall-clock date+time in a timezone to a UTC Date.
 * Uses a two-pass correction so DST boundaries resolve correctly.
 */
export function zonedTimeToUtc(dateStr, timeStr, timeZone) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  const [hh, mm] = String(timeStr || '00:00').split(':').map(Number);
  const naive = Date.UTC(y, m - 1, d, hh, mm, 0, 0);

  let offset = tzOffsetMs(new Date(naive), timeZone);
  let candidate = naive - offset;
  // Second pass corrects for DST transitions.
  offset = tzOffsetMs(new Date(candidate), timeZone);
  candidate = naive - offset;
  return new Date(candidate);
}

/** Weekday (0=Sunday) for a "YYYY-MM-DD" string. */
export function weekdayOf(dateStr) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Add days to a "YYYY-MM-DD" string, returning a new string. */
export function addDaysToDateString(dateStr, days) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Inclusive list of "YYYY-MM-DD" between two strings. */
export function dateRangeStrings(fromStr, toStr) {
  const out = [];
  let cursor = fromStr;
  let guard = 0;
  while (cursor <= toStr && guard < 4000) {
    out.push(cursor);
    cursor = addDaysToDateString(cursor, 1);
    guard += 1;
  }
  return out;
}

export function daysBetween(a, b) {
  const [ay, am, ad] = String(a).split('-').map(Number);
  const [by, bm, bd] = String(b).split('-').map(Number);
  const da = Date.UTC(ay, am - 1, ad);
  const db = Date.UTC(by, bm - 1, bd);
  return Math.round((db - da) / 86400000);
}

export default {
  isValidTimeZone,
  zonedParts,
  tzOffsetMs,
  localDateString,
  localTimeString,
  zonedTimeToUtc,
  weekdayOf,
  addDaysToDateString,
  dateRangeStrings,
  daysBetween,
};
