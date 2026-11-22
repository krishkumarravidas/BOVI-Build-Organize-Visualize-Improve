import { fromDateKey, isValidDateKey, toDateKey } from './dates';
import type { DateKey } from './types';

const pad = (n: number) => String(n).padStart(2, '0');
const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/** `H:mm` / `HH:mm` → hours and minutes, or null. */
export function parseHHMM(value: string): { h: number; m: number } | null {
  const m = HHMM.exec(value.trim());
  return m ? { h: Number(m[1]), m: Number(m[2]) } : null;
}

/** The stored form of a picked time: always `HH:mm`, 24-hour. */
export function toHHMM(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** A Date at `value` today (or at `fallback` when `value` is empty/invalid), for opening a time picker. */
export function timeAsDate(value: string, fallback = '09:00', now = new Date()): Date {
  const t = parseHHMM(value) ?? parseHHMM(fallback) ?? { h: 9, m: 0 };
  const d = new Date(now);
  d.setHours(t.h, t.m, 0, 0);
  return d;
}

/** A Date for a `YYYY-MM-DD` value (or today), for opening a date picker. */
export function dateKeyAsDate(value: string, now = new Date()): Date {
  return isValidDateKey(value) ? fromDateKey(value as DateKey) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export { toDateKey };

/** "8:30 am" (12-hour) or "08:30" (24-hour); the raw text when it isn't a time. */
export function formatTime(value: string, h12: boolean): string {
  const t = parseHHMM(value);
  if (!t) return value;
  if (!h12) return `${pad(t.h)}:${pad(t.m)}`;
  const suffix = t.h < 12 ? 'am' : 'pm';
  return `${t.h % 12 || 12}:${pad(t.m)} ${suffix}`;
}

/** "Mon, 23 Nov 2026" style label for a date key; the raw text when it isn't one. */
export function formatDateKey(value: string, locale?: string): string {
  if (!isValidDateKey(value)) return value;
  return fromDateKey(value as DateKey).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

/** Whether the device formats times with am/pm. Falls back to 12-hour when the platform can't say. */
export function uses12HourClock(): boolean {
  try {
    const o = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions() as Intl.ResolvedDateTimeFormatOptions & { hourCycle?: string; hour12?: boolean };
    if (o.hourCycle) return o.hourCycle === 'h11' || o.hourCycle === 'h12';
    if (typeof o.hour12 === 'boolean') return o.hour12;
  } catch {
    // Intl missing or limited (some Hermes builds): use the common phone default.
  }
  return true;
}
