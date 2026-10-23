import crypto from 'node:crypto';

export const newId = () => crypto.randomUUID();

/** Stable key used for deduplication (e.g. one notification per dose+type+window). */
export const dedupeKey = (...parts) =>
  crypto.createHash('sha1').update(parts.filter(Boolean).join('|')).digest('hex');

/** Round to a fixed number of decimals, guarding against float noise. */
export const round = (value, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
};

export const toDateOnly = (date) => {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};
