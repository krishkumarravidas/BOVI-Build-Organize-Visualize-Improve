import { addDays } from './dates';
import { habitsForDay, isCompleted } from './habits';
import type { DateKey, HabitState } from './types';

export interface DaySummary {
  day: DateKey;
  scheduled: number;
  done: number;
}

/** Per-day completion for the `count` days ending at `today` (oldest first). */
export function recentDays(state: HabitState, today: DateKey, count = 7): DaySummary[] {
  return Array.from({ length: count }, (_, i) => {
    const day = addDays(today, i - (count - 1));
    const habits = habitsForDay(state, day);
    return {
      day,
      scheduled: habits.length,
      done: habits.filter((h) => isCompleted(state, h.id, day)).length,
    };
  });
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Validates `HH:mm` (24h). Empty string means "no reminder" and is valid. */
export function isValidReminderTime(value: string): boolean {
  return value === '' || TIME_RE.test(value);
}
