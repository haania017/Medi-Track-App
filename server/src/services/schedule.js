import { localDateString, weekdayOf, zonedTimeToUtc, daysBetween, addDaysToDateString } from '../utils/timezone.js';

export const DEFAULT_TIMES = ['09:00'];

/** Times a medicine should be taken; falls back to a single morning dose. */
export function scheduleTimes(medicine) {
  const times = medicine?.schedule?.times?.filter(Boolean) ?? [];
  if (times.length) return [...times].sort();
  if (medicine?.schedule?.type === 'as-needed') return [];
  return DEFAULT_TIMES;
}

export function scheduleDoseQuantity(medicine) {
  const q = medicine?.schedule?.doseQuantity;
  return typeof q === 'number' && q > 0 ? q : 1;
}

/** Does this medicine produce a scheduled dose on the given local date? */
export function isScheduledOnDate(medicine, dateStr) {
  const schedule = medicine?.schedule || {};
  const type = schedule.type || 'daily';

  if (type === 'as-needed') return false;

  const start = medicine.startDate ? localDateString(new Date(medicine.startDate), 'UTC') : null;
  if (start && dateStr < start) return false;

  if (medicine.endDate) {
    const end = localDateString(new Date(medicine.endDate), 'UTC');
    if (dateStr > end) return false;
  }

  switch (type) {
    case 'daily':
      return true;
    case 'weekdays':
      return (schedule.weekdays || []).includes(weekdayOf(dateStr));
    case 'interval': {
      const interval = Math.max(1, schedule.intervalDays || 1);
      const anchor = schedule.anchorDate
        ? localDateString(new Date(schedule.anchorDate), 'UTC')
        : start || dateStr;
      const diff = daysBetween(anchor, dateStr);
      if (diff < 0) return false;
      return diff % interval === 0;
    }
    case 'specific-dates':
      return (schedule.specificDates || []).includes(dateStr);
    default:
      return false;
  }
}

/** Concrete UTC instants for one local day. */
export function doseInstantsForDate(medicine, dateStr, timeZone) {
  if (!isScheduledOnDate(medicine, dateStr)) return [];
  return scheduleTimes(medicine).map((time) => ({
    instant: zonedTimeToUtc(dateStr, time, timeZone),
    time,
  }));
}

/** Concrete UTC instants across an inclusive local date range. */
export function doseInstantsForRange(medicine, fromDateStr, toDateStr, timeZone) {
  const out = [];
  let cursor = fromDateStr;
  let guard = 0;
  while (cursor <= toDateStr && guard < 400) {
    for (const entry of doseInstantsForDate(medicine, cursor, timeZone)) {
      out.push({ ...entry, date: cursor });
    }
    cursor = addDaysToDateString(cursor, 1);
    guard += 1;
  }
  return out;
}

export default {
  DEFAULT_TIMES,
  scheduleTimes,
  scheduleDoseQuantity,
  isScheduledOnDate,
  doseInstantsForDate,
  doseInstantsForRange,
};
