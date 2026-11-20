import { currentStreak, longestStreak } from './streaks';
import type { Habit } from './types';

// 2026-11-09 is a Monday.
const daily: Habit = { id: 'h', name: 'Read', days: [0, 1, 2, 3, 4, 5, 6], createdAt: '2026-11-01' };
const weekdays: Habit = { ...daily, days: [1, 2, 3, 4, 5] };

describe('currentStreak', () => {
  it('is 0 with no completions', () => {
    expect(currentStreak(daily, [], '2026-11-10')).toBe(0);
  });

  it('counts consecutive days including today', () => {
    expect(currentStreak(daily, ['2026-11-08', '2026-11-09', '2026-11-10'], '2026-11-10')).toBe(3);
  });

  it('does not break when today is scheduled but not yet done', () => {
    expect(currentStreak(daily, ['2026-11-08', '2026-11-09'], '2026-11-10')).toBe(2);
  });

  it('breaks on a missed day', () => {
    expect(currentStreak(daily, ['2026-11-07', '2026-11-09', '2026-11-10'], '2026-11-10')).toBe(2);
  });

  it('skips unscheduled days without breaking (Fri + Mon with weekend off)', () => {
    // Fri 6th and Mon 9th done; Sat/Sun are not scheduled.
    expect(currentStreak(weekdays, ['2026-11-06', '2026-11-09'], '2026-11-09')).toBe(2);
  });

  it('does not count before the habit was created', () => {
    const h = { ...daily, createdAt: '2026-11-09' };
    expect(currentStreak(h, ['2026-11-08', '2026-11-09', '2026-11-10'], '2026-11-10')).toBe(2);
  });

  it('handles month boundaries', () => {
    const h = { ...daily, createdAt: '2026-10-01' };
    expect(currentStreak(h, ['2026-10-31', '2026-11-01', '2026-11-02'], '2026-11-02')).toBe(3);
  });
});

describe('longestStreak', () => {
  it('is 0 with no completions', () => {
    expect(longestStreak(daily, [])).toBe(0);
  });

  it('finds the longest run across gaps', () => {
    const done = ['2026-11-01', '2026-11-02', '2026-11-04', '2026-11-05', '2026-11-06'];
    expect(longestStreak(daily, done)).toBe(3);
  });

  it('ignores unscheduled days between runs', () => {
    expect(longestStreak(weekdays, ['2026-11-05', '2026-11-06', '2026-11-09'])).toBe(3);
  });
});
