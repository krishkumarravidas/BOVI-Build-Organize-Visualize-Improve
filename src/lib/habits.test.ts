import { addHabit, archiveHabit, createHabit, emptyState, habitsForDay, isCompleted, setCompleted } from './habits';

describe('habit state', () => {
  const today = '2026-11-10'; // Tuesday

  it('creates a habit with trimmed name and all days by default', () => {
    const h = createHabit({ name: '  Run ' }, today, 'a');
    expect(h).toMatchObject({ id: 'a', name: 'Run', days: [0, 1, 2, 3, 4, 5, 6], createdAt: today });
  });

  it('dedupes and sorts days', () => {
    expect(createHabit({ name: 'x', days: [3, 1, 3] }, today, 'a').days).toEqual([1, 3]);
  });

  it('rejects empty names', () => {
    expect(() => createHabit({ name: '   ' }, today, 'a')).toThrow();
  });

  it('toggles completion idempotently', () => {
    let s = addHabit(emptyState(), createHabit({ name: 'x' }, today, 'a'));
    s = setCompleted(setCompleted(s, 'a', today, true), 'a', today, true);
    expect(s.completions.a).toEqual([today]);
    expect(isCompleted(s, 'a', today)).toBe(true);
    s = setCompleted(s, 'a', today, false);
    expect(isCompleted(s, 'a', today)).toBe(false);
  });

  it('filters by weekday and hides archived habits', () => {
    let s = emptyState();
    s = addHabit(s, createHabit({ name: 'mon', days: [1] }, today, 'm'));
    s = addHabit(s, createHabit({ name: 'tue', days: [2] }, today, 't'));
    expect(habitsForDay(s, today).map((h) => h.id)).toEqual(['t']);
    s = archiveHabit(s, 't', today);
    expect(habitsForDay(s, today)).toEqual([]);
  });

  it('does not mutate the previous state', () => {
    const s = emptyState();
    addHabit(s, createHabit({ name: 'x' }, today, 'a'));
    expect(s.habits).toHaveLength(0);
  });
});
