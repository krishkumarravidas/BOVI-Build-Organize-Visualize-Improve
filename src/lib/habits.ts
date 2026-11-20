import { ALL_DAYS, type Completions, type DateKey, type Habit, type HabitState, type Weekday } from './types';
import { weekdayOf } from './dates';

export const emptyState = (): HabitState => ({ version: 2, habits: [], completions: {}, blocks: [] });

export interface NewHabitInput {
  name: string;
  days?: Weekday[];
  reminderTime?: string;
}

export function createHabit(input: NewHabitInput, today: DateKey, id: string): Habit {
  const name = input.name.trim();
  if (!name) throw new Error('Habit name is required');
  const days = [...new Set(input.days?.length ? input.days : ALL_DAYS)].sort() as Weekday[];
  return { id, name, days, reminderTime: input.reminderTime, createdAt: today };
}

export function addHabit(state: HabitState, habit: Habit): HabitState {
  return { ...state, habits: [...state.habits, habit] };
}

export function updateHabit(state: HabitState, id: string, patch: Partial<Omit<Habit, 'id' | 'createdAt'>>): HabitState {
  return { ...state, habits: state.habits.map((h) => (h.id === id ? { ...h, ...patch } : h)) };
}

export function archiveHabit(state: HabitState, id: string, today: DateKey): HabitState {
  return updateHabit(state, id, { archivedAt: today });
}

/** Marks a day done, or undoes it. Idempotent for a given `done` value. */
export function setCompleted(state: HabitState, habitId: string, day: DateKey, done: boolean): HabitState {
  const current = state.completions[habitId] ?? [];
  const without = current.filter((d) => d !== day);
  const next: Completions = { ...state.completions, [habitId]: done ? [...without, day].sort() : without };
  return { ...state, completions: next };
}

/** Active habits scheduled for `day`. */
export function habitsForDay(state: HabitState, day: DateKey): Habit[] {
  return state.habits.filter((h) => !h.archivedAt && h.days.includes(weekdayOf(day)));
}

export function isCompleted(state: HabitState, habitId: string, day: DateKey): boolean {
  return (state.completions[habitId] ?? []).includes(day);
}
