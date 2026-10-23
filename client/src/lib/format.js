import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import isToday from 'dayjs/plugin/isToday';
import isYesterday from 'dayjs/plugin/isYesterday';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(relativeTime);
dayjs.extend(isToday);
dayjs.extend(isYesterday);
dayjs.extend(utc);
dayjs.extend(timezone);

export { dayjs };

export const cx = (...classes) => classes.filter(Boolean).join(' ');

export function formatDate(value, fmt = 'D MMM YYYY') {
  if (!value) return '—';
  return dayjs(value).format(fmt);
}

export function formatTime(value) {
  if (!value) return '—';
  return dayjs(value).format('HH:mm');
}

export function formatDateTime(value) {
  if (!value) return '—';
  return dayjs(value).format('D MMM YYYY, HH:mm');
}

export function fromNow(value) {
  if (!value) return '';
  return dayjs(value).fromNow();
}

export function formatRelativeDay(value) {
  if (!value) return '—';
  const d = dayjs(value);
  if (d.isToday()) return 'Today';
  if (d.isYesterday()) return 'Yesterday';
  return d.format('ddd, D MMM');
}

/** Whole days from now until `value` (negative when in the past). */
export function daysUntil(value) {
  if (!value) return null;
  return Math.ceil(dayjs(value).diff(dayjs(), 'day', true));
}

export function expiryLabel(value) {
  const days = daysUntil(value);
  if (days === null) return { tone: 'muted', label: 'No expiry date' };
  if (days < 0) return { tone: 'danger', label: `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago` };
  if (days === 0) return { tone: 'danger', label: 'Expires today' };
  if (days <= 7) return { tone: 'danger', label: `${days} day${days === 1 ? '' : 's'} left` };
  if (days <= 30) return { tone: 'warning', label: `${days} days left` };
  return { tone: 'muted', label: `Expires ${formatDate(value)}` };
}

export const DOSE_STATUS_META = {
  taken: { label: 'Taken', tone: 'success', icon: 'check' },
  pending: { label: 'Pending', tone: 'info', icon: 'clock' },
  skipped: { label: 'Skipped', tone: 'muted', icon: 'skip' },
  missed: { label: 'Missed', tone: 'danger', icon: 'alert' },
};

export const URGENCY_META = {
  low: { label: 'Low', tone: 'muted', level: 1 },
  normal: { label: 'Normal', tone: 'info', level: 2 },
  high: { label: 'High', tone: 'warning', level: 3 },
  critical: { label: 'Critical', tone: 'danger', level: 4 },
};

export const NOTIFICATION_TYPE_META = {
  dose_reminder: { label: 'Dose reminder', icon: 'pill' },
  missed_dose: { label: 'Missed dose', icon: 'alert' },
  low_stock: { label: 'Low stock', icon: 'package' },
  expiry: { label: 'Expiry', icon: 'calendar' },
  care_plan_review: { label: 'Care plan review', icon: 'clipboard' },
  system: { label: 'System', icon: 'info' },
};

export const MEDICINE_FORMS = [
  'tablet', 'capsule', 'syrup', 'suspension', 'drops', 'injection',
  'inhaler', 'cream', 'ointment', 'spray', 'powder', 'sachet', 'other',
];

export const MEMBER_TYPE_LABEL = {
  owner: 'Account owner',
  adult: 'Connected adult',
  managed: 'Managed profile',
};

/** Initials for avatars, e.g. "Demo Caregiver" → "DC". */
export function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

/** Pick a readable foreground colour for a member colour chip. */
export function contrastText(hex = '#111827') {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#111827' : '#ffffff';
}

export const TIME_OPTIONS = Array.from({ length: 24 * 4 }, (_, i) => {
  const hours = String(Math.floor(i / 4)).padStart(2, '0');
  const minutes = String((i % 4) * 15).padStart(2, '0');
  return `${hours}:${minutes}`;
});

export function listTimeZones() {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return [
      'UTC', 'Asia/Karachi', 'Asia/Kolkata', 'Asia/Dubai', 'Asia/Riyadh',
      'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Los_Angeles', 'Australia/Sydney',
    ];
  }
}
