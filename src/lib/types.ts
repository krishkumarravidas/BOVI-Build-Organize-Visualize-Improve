/** Calendar day in local time, formatted `YYYY-MM-DD`. */
export type DateKey = string;

/** 0 = Sunday ... 6 = Saturday (matches `Date.getDay()`). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const ALL_DAYS: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6];

export interface Habit {
  id: string;
  name: string;
  /** Days of the week the habit is scheduled. Never empty. */
  days: Weekday[];
  /** Optional reminder time, `HH:mm` (24h). */
  reminderTime?: string;
  createdAt: DateKey;
  archivedAt?: DateKey;
}

/** Completed dates per habit id. */
export type Completions = Record<string, DateKey[]>;

/** A recurring time block in the user's week (class, gym, work...). */
export interface ScheduleBlock {
  id: string;
  title: string;
  /** Days the block starts on. Never empty. */
  days: Weekday[];
  /** `HH:mm` (24h). */
  start: string;
  /** `HH:mm` (24h). Earlier than `start` means the block runs past midnight. */
  end: string;
  /** Send a notification when the block starts. */
  remind: boolean;
}

/** A one-off task on a day (optionally at a time), shown on the calendar. */
export interface Todo {
  id: string;
  title: string;
  date: DateKey;
  /** `HH:mm`; without it the task sits in the day's to-do list. */
  time?: string;
  /** Length in minutes for timed tasks (default 30). */
  minutes?: number;
  /** Notify at `time`. */
  remind?: boolean;
  notes?: string;
  done: boolean;
  doneAt?: number;
}

export interface HabitState {
  version: 2;
  habits: Habit[];
  completions: Completions;
  blocks: ScheduleBlock[];
  /** One-off tasks (added later; absent in older data). */
  todos?: Todo[];
}
