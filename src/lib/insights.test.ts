import { addHabit, createHabit, emptyState, setCompleted } from './habits';
import { compareScreenAndHabits, habitWeek, weekStart } from './insights';

describe('insights', () => {
  it('finds the Monday of the week', () => {
    expect(weekStart('2026-11-15')).toBe('2026-11-09'); // Sunday → previous Monday
    expect(weekStart('2026-11-16')).toBe('2026-11-16');
  });

  it('computes habit completion from Monday to today', () => {
    let s = addHabit(emptyState(), createHabit({ name: 'Read' }, '2026-11-01', 'h'));
    s = setCompleted(s, 'h', '2026-11-16', true);
    const w = habitWeek(s, '2026-11-17'); // Mon + Tue
    expect(w).toMatchObject({ done: 1, scheduled: 2, percent: 50 });
  });

  it('compares habit completion on low vs high screen-time days', () => {
    const H = 3_600_000;
    const rows = [
      { day: 'a', screenMs: 2 * H, done: 3, scheduled: 3 },
      { day: 'b', screenMs: 3 * H, done: 2, scheduled: 3 },
      { day: 'c', screenMs: 6 * H, done: 1, scheduled: 3 },
      { day: 'd', screenMs: 7 * H, done: 0, scheduled: 3 },
      { day: 'e', screenMs: 0, done: 3, scheduled: 3 }, // no screen data → ignored
    ];
    expect(compareScreenAndHabits(rows)).toEqual({ thresholdMs: 4.5 * H, lowScreenHabitPct: (5 / 6) * 100, highScreenHabitPct: (1 / 6) * 100 });
    expect(compareScreenAndHabits(rows.slice(0, 3))).toBeNull();
  });
});
