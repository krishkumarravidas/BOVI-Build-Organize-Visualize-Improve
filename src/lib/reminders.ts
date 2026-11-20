import type { Habit, ScheduleBlock } from './types';

export interface ReminderPlan {
  /** Habit or schedule-block id. */
  sourceId: string;
  title: string;
  body: string;
  /** 1 = Sunday ... 7 = Saturday (expo-notifications weekly triggers). */
  weekday: number;
  hour: number;
  minute: number;
}

export function parseReminderTime(value: string): { hour: number; minute: number } | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return m ? { hour: Number(m[1]), minute: Number(m[2]) } : null;
}

/**
 * One weekly reminder per scheduled day: for active habits with a valid reminder time,
 * and for schedule blocks with `remind` on (fires at the block's start).
 */
export function planReminders(habits: readonly Habit[], blocks: readonly ScheduleBlock[] = []): ReminderPlan[] {
  const fromHabits = habits.flatMap((habit) => {
    if (habit.archivedAt || !habit.reminderTime) return [];
    const time = parseReminderTime(habit.reminderTime);
    if (!time) return [];
    return habit.days.map((day) => ({
      sourceId: habit.id,
      title: habit.name,
      body: 'Time for your habit.',
      weekday: day + 1,
      ...time,
    }));
  });
  const fromBlocks = blocks.flatMap((block) => {
    if (!block.remind) return [];
    const time = parseReminderTime(block.start);
    if (!time) return [];
    return block.days.map((day) => ({
      sourceId: block.id,
      title: block.title,
      body: `Starting now, until ${block.end}.`,
      weekday: day + 1,
      ...time,
    }));
  });
  return [...fromHabits, ...fromBlocks];
}
