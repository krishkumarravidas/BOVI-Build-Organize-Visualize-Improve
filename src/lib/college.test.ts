import { seedCollege } from '@/lib/__fixtures__/demo';

import {
  addExtraClass,
  cancelOccurrence,
  countdownLabel,
  editOccurrence,
  migrateCollege,
  moveOccurrence,
  nextClassDay,
  overlappingClassKeys,
  resolveDay,
  restoreOccurrence,
  upcomingExams,
  validateSlot,
  type CollegeState,
} from './college';
import { daysBetween, isValidDateKey } from './dates';

// 2026-11-16 is a Monday; 2026-11-21 Saturday.
const MON = '2026-11-16';
const state = (): CollegeState => seedCollege();

describe('date helpers', () => {
  it('validates date keys and counts days', () => {
    expect(isValidDateKey('2026-11-16')).toBe(true);
    expect(isValidDateKey('2026-02-30')).toBe(false);
    expect(isValidDateKey('16-11-2026')).toBe(false);
    expect(daysBetween('2026-11-15', '2026-11-20')).toBe(5);
    expect(daysBetween('2026-11-20', '2026-11-15')).toBe(-5);
  });
});

describe('resolveDay', () => {
  it('lists the seeded Monday timetable in order with default room', () => {
    const day = resolveDay(state(), MON);
    expect(day.map((o) => [o.startText, o.title])).toEqual([
      ['08:30', 'Data Structures & Algorithms'],
      ['09:25', 'OOPS with Java'],
      ['10:40', 'Artificial Intelligence'],
      ['11:35', 'Digital Design & Computer Org.'],
      ['13:25', 'Probability & Statistics for ML'],
      ['14:20', 'Societal Project'],
    ]);
    expect(day.every((o) => o.room === 'Room 204' && o.status === 'regular')).toBe(true);
  });

  it('uses slot titles and rooms over defaults', () => {
    const fri = resolveDay(state(), '2026-11-20');
    expect(fri.find((o) => o.title === 'Additional Maths-I')?.room).toBe('Sir C V Raman Block, CR 302');
    expect(fri.some((o) => o.title === 'OOPS Tutorial')).toBe(true);
  });

  it('has no classes on weekends', () => {
    expect(resolveDay(state(), '2026-11-21')).toEqual([]);
    expect(nextClassDay(state(), '2026-11-21')).toBe('2026-11-23');
  });
});

describe('one-off changes', () => {
  const firstSlot = (s: CollegeState) => resolveDay(s, MON)[0].slotId!;

  it('cancels and restores a class for one date only', () => {
    let s = state();
    const id = firstSlot(s);
    s = cancelOccurrence(s, MON, id, 'c1');
    expect(resolveDay(s, MON)[0].status).toBe('cancelled');
    expect(resolveDay(s, '2026-11-23')[0].status).toBe('regular'); // next Monday untouched
    s = restoreOccurrence(s, MON, id);
    expect(resolveDay(s, MON)[0].status).toBe('regular');
    expect(s.changes).toEqual([]);
  });

  it('edits time and room for one date, re-sorting the day', () => {
    let s = state();
    s = editOccurrence(s, MON, firstSlot(s), { start: '15:00', end: '15:55', room: 'Lab 2' }, 'e1');
    const day = resolveDay(s, MON);
    const moved = day[day.length - 1];
    expect(moved).toMatchObject({ title: 'Data Structures & Algorithms', startText: '15:00', room: 'Lab 2', status: 'changed' });
  });

  it('a new edit replaces a cancel for the same class and date', () => {
    let s = state();
    const id = firstSlot(s);
    s = cancelOccurrence(s, MON, id, 'c1');
    s = editOccurrence(s, MON, id, { start: '08:30', end: '09:25', room: 'X' }, 'e1');
    expect(s.changes).toHaveLength(1);
    expect(resolveDay(s, MON)[0].status).toBe('changed');
  });

  it('rejects bad times', () => {
    expect(() => editOccurrence(state(), MON, 'seed-slot-1', { start: '10:00', end: '09:00' }, 'e')).toThrow('End must be after start');
  });

  it('adds extra classes, including on weekends', () => {
    const s = addExtraClass(state(), { date: '2026-11-21', start: '10:00', end: '11:00', subjectId: 'dsa' }, 'x1');
    expect(resolveDay(s, '2026-11-21')).toEqual([expect.objectContaining({ title: 'Data Structures & Algorithms', status: 'extra' })]);
  });

  it('moves a class to another day: cancelled here, extra there, same subject/title', () => {
    let s = state();
    const occ = resolveDay(s, '2026-11-19').find((o) => o.title === 'OOPS Tutorial')!; // Thursday
    s = moveOccurrence(s, occ, { date: '2026-11-21', start: '09:00', end: '09:55' }, { cancelId: 'c', extraId: 'x' });
    expect(resolveDay(s, '2026-11-19').find((o) => o.title === 'OOPS Tutorial')?.status).toBe('cancelled');
    expect(resolveDay(s, '2026-11-21')).toEqual([
      expect.objectContaining({ title: 'OOPS Tutorial', startText: '09:00', status: 'extra', note: 'Moved from 2026-11-19' }),
    ]);
  });

  it('moving an extra class relocates it instead of cancelling', () => {
    let s = addExtraClass(state(), { date: '2026-11-21', start: '10:00', end: '11:00', title: 'Doubt session' }, 'x1');
    const occ = resolveDay(s, '2026-11-21')[0];
    s = moveOccurrence(s, occ, { date: '2026-11-22', start: '10:00', end: '11:00' }, { cancelId: 'c', extraId: 'x2' });
    expect(resolveDay(s, '2026-11-21')).toEqual([]);
    expect(resolveDay(s, '2026-11-22')[0].title).toBe('Doubt session');
  });
});

describe('validateSlot', () => {
  it('needs a subject or title and a valid range', () => {
    expect(validateSlot({ day: 1, start: '08:30', end: '09:25' })).toBe('Pick a subject or enter a title');
    expect(validateSlot({ day: 1, start: '08:30', end: '09:25', title: 'Library' })).toBeNull();
  });
});

describe('upcomingExams', () => {
  it('sorts upcoming exams with countdowns and flags the Robotics Workshop clash', () => {
    const list = upcomingExams(state(), '2026-11-15');
    expect(list.map((e) => e.exam.id)).toEqual(['ia1-psml', 'ia1-ai', 'ia1-java', 'ia1-ddco', 'ia1-dsa', 'ia1-maths']);
    expect(countdownLabel(list[0].daysAway)).toBe('Tomorrow');
    expect(list.find((e) => e.exam.id === 'ia1-maths')?.clashes).toEqual(['Robotics Workshop (club)']);
    expect(list.find((e) => e.exam.id === 'ia1-psml')?.clashes).toEqual([]);
    expect(list.find((e) => e.exam.id === 'ia1-ddco')?.title).toBe('DLCO (DDCO)');
  });

  it('drops past exams and flags overlapping exams', () => {
    const s = state();
    s.exams.push({ id: 'dup', series: 'IA1', title: 'Clash test', date: '2026-11-16', start: '10:00', end: '10:30' });
    const list = upcomingExams(s, '2026-11-17');
    expect(list.some((e) => e.exam.date < '2026-11-17')).toBe(false);
    expect(upcomingExams(s, '2026-11-16').find((e) => e.exam.id === 'ia1-psml')?.clashes).toContain('Clash test exam');
  });
});

describe('migrateCollege', () => {
  it('accepts v1 and rejects junk', () => {
    expect(migrateCollege(state())).toEqual(state());
    expect(migrateCollege({ version: 1 })).toBeNull();
    expect(migrateCollege(null)).toBeNull();
  });
});

describe('overlappingClassKeys', () => {
  it('flags classes that collide after a move, ignoring cancelled ones', () => {
    let s = state();
    const ai = resolveDay(s, MON).find((o) => o.title === 'Artificial Intelligence')!;
    s = moveOccurrence(s, ai, { date: '2026-11-17', start: '10:40', end: '11:35' }, { cancelId: 'c', extraId: 'x' });
    const tue = resolveDay(s, '2026-11-17');
    const keys = overlappingClassKeys(tue);
    expect(tue.filter((o) => keys.has(o.key)).map((o) => o.title).sort()).toEqual(['Artificial Intelligence', 'OOPS with Java']);
    expect(overlappingClassKeys(resolveDay(s, MON)).size).toBe(0);
  });
});
