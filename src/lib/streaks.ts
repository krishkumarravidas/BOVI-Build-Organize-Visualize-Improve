import { addDays, weekdayOf } from './dates';
import type { DateKey, Habit } from './types';

const isScheduled = (habit: Habit, day: DateKey) => habit.days.includes(weekdayOf(day));

/**
 * Current streak: consecutive *scheduled* days completed, counting back from `today`.
 * Unscheduled days are skipped (they neither extend nor break the streak).
 * If today is scheduled but not yet done, the streak is not broken: counting starts yesterday.
 */
export function currentStreak(habit: Habit, completed: readonly DateKey[], today: DateKey): number {
  if (habit.days.length === 0) return 0;
  const done = new Set(completed);
  let streak = 0;
  let day = today;

  if (isScheduled(habit, day) && !done.has(day)) day = addDays(day, -1);

  // Bounded by habit creation so an empty history terminates.
  while (day >= habit.createdAt) {
    if (isScheduled(habit, day)) {
      if (!done.has(day)) break;
      streak++;
    }
    day = addDays(day, -1);
  }
  return streak;
}

/** Longest run of consecutive scheduled days completed, over all history. */
export function longestStreak(habit: Habit, completed: readonly DateKey[]): number {
  if (habit.days.length === 0 || completed.length === 0) return 0;
  const done = new Set(completed);
  const first = [...completed].sort()[0];
  const last = [...completed].sort().at(-1) as DateKey;

  let best = 0;
  let run = 0;
  for (let day = first; day <= last; day = addDays(day, 1)) {
    if (!isScheduled(habit, day)) continue;
    run = done.has(day) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}
