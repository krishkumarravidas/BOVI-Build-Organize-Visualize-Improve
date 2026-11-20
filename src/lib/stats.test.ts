import { addHabit, createHabit, emptyState, setCompleted } from './habits';
import { isValidReminderTime, recentDays } from './stats';

describe('recentDays', () => {
  it('summarises scheduled vs done, oldest first', () => {
    let s = addHabit(emptyState(), createHabit({ name: 'a' }, '2026-11-01', 'a'));
    s = addHabit(s, createHabit({ name: 'b', days: [2] }, '2026-11-01', 'b')); // Tuesdays
    s = setCompleted(s, 'a', '2026-11-10', true);
    s = setCompleted(s, 'b', '2026-11-10', true);
    const days = recentDays(s, '2026-11-10', 3); // Sun 8, Mon 9, Tue 10
    expect(days.map((d) => d.day)).toEqual(['2026-11-08', '2026-11-09', '2026-11-10']);
    expect(days.map((d) => [d.scheduled, d.done])).toEqual([[1, 0], [1, 0], [2, 2]]);
  });
});

describe('isValidReminderTime', () => {
  it.each(['', '00:00', '09:30', '23:59'])('accepts %p', (v) => expect(isValidReminderTime(v)).toBe(true));
  it.each(['9:30', '24:00', '12:60', 'abc', '12:3'])('rejects %p', (v) => expect(isValidReminderTime(v)).toBe(false));
});
