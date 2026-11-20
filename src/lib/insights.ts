import { addDays, fromDateKey } from './dates';
import { recentDays } from './stats';
import type { DateKey, HabitState } from './types';

/** Monday of the week containing `day`. */
export function weekStart(day: DateKey): DateKey {
  return addDays(day, -((fromDateKey(day).getDay() + 6) % 7));
}

/** Habit completion from Monday through `today`. */
export function habitWeek(state: HabitState, today: DateKey) {
  const days = recentDays(state, today, ((fromDateKey(today).getDay() + 6) % 7) + 1);
  const scheduled = days.reduce((a, d) => a + d.scheduled, 0);
  const done = days.reduce((a, d) => a + d.done, 0);
  return { done, scheduled, percent: scheduled ? (done / scheduled) * 100 : null, days };
}

export interface ScreenHabitComparison {
  /** Median daily screen time used to split the days. */
  thresholdMs: number;
  lowScreenHabitPct: number;
  highScreenHabitPct: number;
}

/**
 * Splits days at the median screen time and compares habit completion on lighter vs heavier days.
 * Needs at least 4 days that have both screen time and scheduled habits.
 */
export function compareScreenAndHabits(rows: { day: DateKey; screenMs: number; done: number; scheduled: number }[]): ScreenHabitComparison | null {
  const usable = rows.filter((r) => r.scheduled > 0 && r.screenMs > 0).sort((a, b) => a.screenMs - b.screenMs);
  if (usable.length < 4) return null;
  const mid = Math.floor(usable.length / 2);
  const low = usable.slice(0, mid);
  const high = usable.slice(usable.length - mid);
  const pct = (xs: typeof usable) => (xs.reduce((a, r) => a + r.done, 0) / xs.reduce((a, r) => a + r.scheduled, 0)) * 100;
  const thresholdMs = usable.length % 2 ? usable[mid].screenMs : (usable[mid - 1].screenMs + usable[mid].screenMs) / 2;
  return { thresholdMs, lowScreenHabitPct: pct(low), highScreenHabitPct: pct(high) };
}
