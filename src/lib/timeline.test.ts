import type { AgendaEvent } from './agenda';
import { addHabit, createHabit, emptyState, setCompleted } from './habits';
import { buildTimeline } from './timeline';
import type { ScheduleBlock } from './types';

const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min);
const day = '2026-11-16'; // Monday
const ev = (id: string, start: Date, end: Date, allDay = false): AgendaEvent => ({ id, calendarId: 'c', title: id, start, end, allDay });
const block: ScheduleBlock = { id: 'b', title: 'Class', days: [1], start: '09:00', end: '10:30', remind: false };

describe('buildTimeline', () => {
  it('merges events, blocks and timed habits in start order', () => {
    let state = addHabit(emptyState(), createHabit({ name: 'Read', reminderTime: '21:00' }, '2026-11-01', 'h'));
    state = addHabit(state, createHabit({ name: 'No time' }, '2026-11-01', 'h2'));
    state = setCompleted(state, 'h', day, true);
    const t = buildTimeline(day, {
      events: [ev('standup', at(2026, 11, 16, 11), at(2026, 11, 16, 11, 15)), ev('holiday', at(2026, 11, 16), at(2026, 11, 17), true)],
      blocks: [block],
      habitState: state,
    });
    expect(t.allDay.map((e) => e.id)).toEqual(['holiday']);
    expect(t.items.map((i) => [i.kind, i.title])).toEqual([
      ['block', 'Class'],
      ['event', 'standup'],
      ['habit', 'Read'],
    ]);
    expect(t.items[2]).toMatchObject({ done: true });
  });

  it('flags overlapping blocks and events but not habits', () => {
    const state = addHabit(emptyState(), createHabit({ name: 'Stretch', reminderTime: '09:30' }, '2026-11-01', 'h'));
    const t = buildTimeline(day, {
      events: [ev('meeting', at(2026, 11, 16, 10), at(2026, 11, 16, 11)), ev('later', at(2026, 11, 16, 14), at(2026, 11, 16, 15))],
      blocks: [block],
      habitState: state,
    });
    const byTitle = Object.fromEntries(t.items.map((i) => [i.title, i]));
    expect(byTitle.Class).toMatchObject({ conflict: true });
    expect(byTitle.meeting).toMatchObject({ conflict: true });
    expect(byTitle.later).toMatchObject({ conflict: false });
    expect(byTitle.Stretch).not.toHaveProperty('conflict');
  });

  it('treats back-to-back items as not overlapping', () => {
    const t = buildTimeline(day, { events: [ev('next', at(2026, 11, 16, 10, 30), at(2026, 11, 16, 11))], blocks: [block] });
    expect(t.items.every((i) => i.kind === 'habit' || !i.conflict)).toBe(true);
  });

  it('puts timed events covering the whole day in the all-day list', () => {
    const t = buildTimeline(day, { events: [ev('trip', at(2026, 11, 15, 18), at(2026, 11, 17, 9))] });
    expect(t.allDay.map((e) => e.id)).toEqual(['trip']);
    expect(t.items).toEqual([]);
  });
});

describe('buildTimeline with college', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { seedCollege } = require('@/lib/__fixtures__/demo');

  it('includes non-cancelled classes and timed exams, but no class/exam overlap flags', () => {
    const college = seedCollege();
    const t = buildTimeline('2026-11-16', { college });
    const kinds = t.items.map((i) => i.kind);
    expect(kinds.filter((k) => k === 'class')).toHaveLength(6);
    expect(t.items.filter((i) => i.kind === 'exam').map((i) => i.title)).toEqual([
      'IA1: Probability & Statistics for ML',
      'IA1: Artificial Intelligence',
    ]);
    expect(t.items.some((i) => i.kind !== 'habit' && i.conflict)).toBe(false);
  });

  it('puts untimed exams in all-day and flags a class overlapping a schedule block', () => {
    const college = seedCollege();
    const fri = buildTimeline('2026-11-20', {
      college,
      blocks: [{ id: 'b', title: 'Gym', days: [5], start: '08:00', end: '09:00', remind: false }],
    });
    expect(fri.allDay.map((e) => e.title)).toEqual(['IA1: Additional Maths-I (time TBA)']);
    const lab = fri.items.find((i) => i.kind === 'class' && i.title.startsWith('DSA Lab B2'));
    expect(lab).toMatchObject({ conflict: true });
  });
});
