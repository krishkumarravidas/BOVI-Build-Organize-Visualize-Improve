import { addDays, atTime, toDateKey } from './dates';
import type { DatedReminder } from './examReminders';
import type { DateKey, HabitState, Todo } from './types';

export const TASK_DURATIONS = [15, 30, 60, 90, 120];

export function upsertTodo(state: HabitState, todo: Todo): HabitState {
  const list = state.todos ?? [];
  return { ...state, todos: list.some((t) => t.id === todo.id) ? list.map((t) => (t.id === todo.id ? todo : t)) : [...list, todo] };
}

export function removeTodo(state: HabitState, id: string): HabitState {
  return { ...state, todos: (state.todos ?? []).filter((t) => t.id !== id) };
}

export function setTodoDone(state: HabitState, id: string, done: boolean, now: number): HabitState {
  return {
    ...state,
    todos: (state.todos ?? []).map((t) => {
      if (t.id !== id) return t;
      const { doneAt: _d, ...rest } = t;
      void _d;
      return done ? { ...rest, done, doneAt: now } : { ...rest, done };
    }),
  };
}

/** Moves a task to another day (e.g. "tomorrow"), keeping its time. */
export function moveTodo(state: HabitState, id: string, date: DateKey): HabitState {
  return { ...state, todos: (state.todos ?? []).map((t) => (t.id === id ? { ...t, date } : t)) };
}

/**
 * Untimed tasks for a day's to-do list. On today, unfinished tasks from earlier days carry over
 * (flagged `overdue`) so nothing silently disappears.
 */
export function untimedTodos(state: HabitState, day: DateKey, today: DateKey): { todo: Todo; overdue: boolean }[] {
  const out: { todo: Todo; overdue: boolean }[] = [];
  for (const t of state.todos ?? []) {
    if (t.time) continue;
    if (t.date === day) out.push({ todo: t, overdue: false });
    else if (day === today && t.date < today && !t.done) out.push({ todo: t, overdue: true });
  }
  return out.sort((a, b) => Number(a.todo.done) - Number(b.todo.done) || a.todo.date.localeCompare(b.todo.date));
}

/** Timed, unfinished tasks from earlier days that were missed (shown on today). */
export function missedTimed(state: HabitState, today: DateKey): Todo[] {
  return (state.todos ?? []).filter((t) => t.time && !t.done && t.date < today && t.date >= addDays(today, -14));
}

/** Drops finished tasks older than ~60 days so the list doesn't grow forever. */
export function pruneTodos(state: HabitState, today: DateKey): HabitState {
  if (!state.todos) return state;
  const cutoff = addDays(today, -60);
  const kept = state.todos.filter((t) => !(t.done && t.date < cutoff));
  return kept.length === state.todos.length ? state : { ...state, todos: kept };
}

/** Notifications for timed tasks with "remind" on, over the next two weeks. */
export function taskReminders(state: HabitState, now: Date): DatedReminder[] {
  const today = toDateKey(now);
  const last = addDays(today, 14);
  const out: DatedReminder[] = [];
  for (const t of state.todos ?? []) {
    if (t.done || !t.time || !t.remind || t.date < today || t.date > last) continue;
    const date = atTime(t.date, t.time);
    if (date > now) out.push({ id: `task:${t.id}`, title: t.title, body: t.notes ?? 'Task', date });
  }
  return out;
}

/** Open tasks for a day (plus carried-over ones on today), for the morning briefing. */
export function openTasksOn(state: HabitState, day: DateKey, today: DateKey): Todo[] {
  return (state.todos ?? []).filter((t) => !t.done && (t.date === day || (day === today && t.date < today && !t.time)));
}
