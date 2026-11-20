import { dayScore, formatGap, layoutDay, PX_PER_MIN, yFor } from './calendarLayout';
import type { TimelineItem } from './timeline';

const day = new Date(2026, 10, 16);
const at = (h: number, m = 0) => new Date(2026, 10, 16, h, m);
const block = (key: string, s: Date, e: Date): TimelineItem => ({ kind: 'block', key, blockId: key, title: key, start: s, end: e, conflict: false });
const habit = (key: string, s: Date): TimelineItem => ({ kind: 'habit', key, habitId: key, title: key, start: s, done: false });

describe('layoutDay', () => {
  it('uses a 07:00–22:00 default range and positions blocks by minutes', () => {
    const l = layoutDay([block('a', at(8, 30), at(9, 25))], day);
    expect([l.startHour, l.endHour]).toEqual([7, 22]);
    expect(l.blocks[0]).toMatchObject({ lane: 0, lanes: 1 });
    expect(l.blocks[0].top).toBeCloseTo(90 * PX_PER_MIN);
    expect(l.blocks[0].height).toBeCloseTo(55 * PX_PER_MIN);
    expect(l.height).toBe(15 * 60 * PX_PER_MIN);
  });

  it('stretches the range for early and late items', () => {
    const l = layoutDay([block('sleep', at(23), new Date(2026, 10, 17, 7)), habit('h', at(5, 45))], day);
    expect([l.startHour, l.endHour]).toEqual([5, 24]);
  });

  it('puts overlapping blocks in side-by-side lanes and reuses lanes after they free up', () => {
    const l = layoutDay([block('a', at(9), at(11)), block('b', at(10), at(12)), block('c', at(11), at(12, 30)), block('d', at(14), at(15))], day);
    const by = Object.fromEntries(l.blocks.map((b) => [b.item.key, [b.lane, b.lanes]]));
    expect(by).toEqual({ a: [0, 2], b: [1, 2], c: [0, 2], d: [0, 1] });
  });

  it('enforces a minimum block height', () => {
    expect(layoutDay([block('p', at(15, 15), at(15, 30))], day).blocks[0].height).toBe(30);
  });

  it('reports free gaps of at least 20 minutes between busy periods', () => {
    const l = layoutDay([block('a', at(8, 30), at(9, 25)), block('b', at(9, 25), at(10, 20)), block('c', at(10, 40), at(11, 35)), block('d', at(13, 25), at(14, 20))], day);
    expect(l.gaps.map((g) => g.minutes)).toEqual([20, 110]);
    expect(l.gaps[0].top).toBe((10 * 60 + 20 - 7 * 60) * PX_PER_MIN);
  });

  it('places habits as points and finds the now line', () => {
    const l = layoutDay([habit('read', at(21))], day);
    expect(l.points[0].top).toBe(14 * 60 * PX_PER_MIN);
    expect(yFor(l, day, at(12))).toBe(5 * 60 * PX_PER_MIN);
    expect(yFor(l, day, at(23))).toBeNull();
  });
});

describe('dayScore / formatGap', () => {
  it('scores completion and formats durations', () => {
    expect(dayScore(0, 0)).toBeNull();
    expect(dayScore(2, 3)).toBe(67);
    expect(formatGap(20)).toBe('20m');
    expect(formatGap(60)).toBe('1h');
    expect(formatGap(110)).toBe('1h 50m');
  });
});

describe('dayProgress', () => {
  it('counts habits, revision and assignments for the day', () => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { seedCollege } = require('@/lib/__fixtures__/demo');
    const H = require('./habits');
    const { dayProgress } = require('./calendarLayout');
    /* eslint-enable @typescript-eslint/no-require-imports */
    let s = H.addHabit(H.emptyState(), H.createHabit({ name: 'Read' }, '2026-11-01', 'h'));
    s = H.setCompleted(s, 'h', '2026-11-16', true);
    const c = seedCollege();
    c.study.push({ id: 's', title: 'Rev', date: '2026-11-16', start: '18:00', end: '19:00', done: false });
    c.assignments.push({ id: 'a', title: 'Lab', due: '2026-11-16', done: true });
    expect(dayProgress(s, c, '2026-11-16')).toEqual({ done: 2, total: 3 });
    expect(dayProgress(s, c, '2026-11-17')).toEqual({ done: 0, total: 1 });
  });
});
