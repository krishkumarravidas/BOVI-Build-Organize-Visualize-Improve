import { blockOccurrences, createBlock, describeDays, isOvernight, validateBlock } from './schedule';
import type { ScheduleBlock } from './types';

const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min);
// 2026-11-16 is a Monday.
const block = (over: Partial<ScheduleBlock> = {}): ScheduleBlock => ({
  id: 'b', title: 'Class', days: [1], start: '09:00', end: '10:30', remind: false, ...over,
});

describe('validateBlock / createBlock', () => {
  const ok = { title: ' Gym ', days: [3, 1, 3] as (1 | 3)[], start: '18:00', end: '19:00' };
  it('accepts valid input and normalises it', () => {
    expect(validateBlock(ok)).toBeNull();
    expect(createBlock(ok, 'x')).toEqual({ id: 'x', title: 'Gym', days: [1, 3], start: '18:00', end: '19:00', remind: false });
  });
  it.each([
    [{ ...ok, title: ' ' }, 'Enter a title'],
    [{ ...ok, days: [] }, 'Pick at least one day'],
    [{ ...ok, start: '7:00' }, 'Use 24h times, e.g. 09:00'],
    [{ ...ok, end: '18:00' }, 'Start and end must differ'],
  ])('rejects %p', (input, msg) => {
    expect(validateBlock(input)).toBe(msg);
    expect(() => createBlock(input, 'x')).toThrow(msg);
  });
});

describe('blockOccurrences', () => {
  it('returns the block on its scheduled day only', () => {
    expect(blockOccurrences([block()], '2026-11-16')).toEqual([
      { block: block(), start: at(2026, 11, 16, 9), end: at(2026, 11, 16, 10, 30) },
    ]);
    expect(blockOccurrences([block()], '2026-11-17')).toEqual([]);
  });

  it('carries overnight blocks into the next morning', () => {
    const sleep = block({ title: 'Sleep', start: '23:00', end: '07:00' }); // starts Mondays
    expect(isOvernight(sleep)).toBe(true);
    const mon = blockOccurrences([sleep], '2026-11-16');
    expect(mon).toEqual([{ block: sleep, start: at(2026, 11, 16, 23), end: at(2026, 11, 17, 7) }]);
    const tue = blockOccurrences([sleep], '2026-11-17');
    expect(tue).toEqual([{ block: sleep, start: at(2026, 11, 16, 23), end: at(2026, 11, 17, 7) }]);
  });
});

describe('describeDays', () => {
  it('names common patterns', () => {
    expect(describeDays([0, 1, 2, 3, 4, 5, 6])).toBe('Every day');
    expect(describeDays([1, 2, 3, 4, 5])).toBe('Weekdays');
    expect(describeDays([0, 6])).toBe('Weekends');
    expect(describeDays([1, 3])).toBe('Mon, Wed');
  });
});
