import { parseReminderTime, planReminders } from './reminders';
import type { Habit } from './types';

const base: Habit = { id: 'a', name: 'Run', days: [1, 3], createdAt: '2026-11-01', reminderTime: '07:05' };

describe('planReminders', () => {
  it('creates one reminder per scheduled day with 1-based weekdays', () => {
    expect(planReminders([base])).toEqual([
      { sourceId: 'a', title: 'Run', body: 'Time for your habit.', weekday: 2, hour: 7, minute: 5 },
      { sourceId: 'a', title: 'Run', body: 'Time for your habit.', weekday: 4, hour: 7, minute: 5 },
    ]);
  });

  it('skips habits without a reminder, archived habits and invalid times', () => {
    expect(planReminders([{ ...base, reminderTime: undefined }])).toEqual([]);
    expect(planReminders([{ ...base, archivedAt: '2026-11-05' }])).toEqual([]);
    expect(planReminders([{ ...base, reminderTime: '25:00' }])).toEqual([]);
  });

  it('maps Sunday (0) to weekday 1', () => {
    expect(planReminders([{ ...base, days: [0] }])[0].weekday).toBe(1);
  });
});

describe('planReminders for blocks', () => {
  const block = { id: 'b', title: 'Class', days: [1, 3] as (0 | 1 | 2 | 3 | 4 | 5 | 6)[], start: '09:30', end: '11:00', remind: true };

  it('reminds at block start on each scheduled day', () => {
    expect(planReminders([], [block])).toEqual([
      { sourceId: 'b', title: 'Class', body: 'Starting now, until 11:00.', weekday: 2, hour: 9, minute: 30 },
      { sourceId: 'b', title: 'Class', body: 'Starting now, until 11:00.', weekday: 4, hour: 9, minute: 30 },
    ]);
  });

  it('skips blocks with reminders off', () => {
    expect(planReminders([], [{ ...block, remind: false }])).toEqual([]);
  });
});

describe('parseReminderTime', () => {
  it('parses valid and rejects invalid', () => {
    expect(parseReminderTime('23:59')).toEqual({ hour: 23, minute: 59 });
    expect(parseReminderTime('7:00')).toBeNull();
  });
});
