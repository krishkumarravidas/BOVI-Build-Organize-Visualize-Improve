import type { DateKey, Weekday } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateKey(date: Date): DateKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Parses a DateKey as local midnight (avoids UTC shifting from `new Date('YYYY-MM-DD')`). */
export function fromDateKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: DateKey, delta: number): DateKey {
  const date = fromDateKey(key);
  date.setDate(date.getDate() + delta);
  return toDateKey(date);
}

export function weekdayOf(key: DateKey): Weekday {
  return fromDateKey(key).getDay() as Weekday;
}

/** Strict `YYYY-MM-DD` that is a real calendar date. */
export function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return toDateKey(fromDateKey(value)) === value;
}

/** Whole days from `from` to `to` (negative if `to` is earlier). DST-safe. */
export function daysBetween(from: DateKey, to: DateKey): number {
  const a = fromDateKey(from);
  const b = fromDateKey(to);
  return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86_400_000);
}

/** Local Date for `day` at `HH:mm` (invalid times fall back to midnight). */
export function atTime(day: DateKey, hhmm: string): Date {
  const d = fromDateKey(day);
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (m) d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d;
}
