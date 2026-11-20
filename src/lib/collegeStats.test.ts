import { seedCollege } from '@/lib/__fixtures__/demo';

import { resolveDay } from './college';
import { attendanceBySubject, attendanceStats, dueAssignments, markAttendance, subjectMarks, unmarkedClasses, validateMark } from './collegeStats';

describe('attendanceStats', () => {
  it('computes percent, classes you can skip and classes you must attend', () => {
    expect(attendanceStats(0, 0, 75)).toEqual({ present: 0, total: 0, percent: null, canSkip: 0, mustAttend: 0 });
    // 9/10 = 90%: can miss 2 (9/12 = 75%), not 3 (9/13 = 69%).
    expect(attendanceStats(9, 10, 75)).toMatchObject({ percent: 90, canSkip: 2, mustAttend: 0 });
    // 6/10 = 60%: need 6 in a row (12/16 = 75%).
    expect(attendanceStats(6, 10, 75)).toMatchObject({ percent: 60, canSkip: 0, mustAttend: 6 });
    // Exactly on target.
    expect(attendanceStats(3, 4, 75)).toMatchObject({ canSkip: 0, mustAttend: 0 });
  });
});

describe('markAttendance / attendanceBySubject', () => {
  it('records per occurrence, replaces on re-mark, clears with null', () => {
    let s = seedCollege();
    const [dsa, java] = resolveDay(s, '2026-11-16');
    s = markAttendance(s, dsa, 'present');
    s = markAttendance(s, java, 'absent');
    s = markAttendance(s, java, 'present');
    expect(s.attendance).toHaveLength(2);
    const stats = attendanceBySubject(s);
    expect(stats.overall).toMatchObject({ present: 2, total: 2, percent: 100 });
    expect(stats.bySubject.find((x) => x.subject.id === 'dsa')).toMatchObject({ present: 1, total: 1 });
    s = markAttendance(s, dsa, null);
    expect(s.attendance).toHaveLength(1);
  });

  it('lists unmarked past subject classes only', () => {
    const s = seedCollege();
    const now = new Date(2026, 10, 16, 10, 0); // Mon 10:00: DSA and Java have started
    const list = unmarkedClasses(s, '2026-11-16', now, 0);
    expect(list.map((o) => o.title)).toEqual(['Data Structures & Algorithms', 'OOPS with Java']);
  });
});

describe('subjectMarks', () => {
  const grade = { internalWeight: 50, finalMax: 100, target: 60 };
  it('sums internals and works out the final score needed', () => {
    const m = subjectMarks(
      [
        { id: 'a', subjectId: 'dsa', label: 'IA1', scored: 20, outOf: 25 },
        { id: 'b', subjectId: 'dsa', label: 'IA2', scored: 15, outOf: 25 },
      ],
      grade,
    );
    // Internal 70% → need (60 - 35) / 0.5 = 50% of 100.
    expect(m).toEqual({ scored: 35, outOf: 50, percent: 70, neededInFinal: 50 });
  });
  it('handles no entries and caps at zero when already safe', () => {
    expect(subjectMarks([], grade).neededInFinal).toBeNull();
    expect(subjectMarks([{ id: 'a', subjectId: 'x', label: 'IA1', scored: 25, outOf: 25 }], { ...grade, target: 40 }).neededInFinal).toBe(0);
  });
  it('validates entries', () => {
    expect(validateMark({ label: 'IA1', scored: 30, outOf: 25 })).toMatch(/between/);
    expect(validateMark({ label: ' ', scored: 1, outOf: 25 })).toMatch(/label/);
    expect(validateMark({ label: 'IA1', scored: 20, outOf: 25 })).toBeNull();
  });
});

describe('dueAssignments', () => {
  it('lists open assignments due soon, flagging overdue ones', () => {
    const s = seedCollege();
    s.assignments = [
      { id: '1', title: 'Lab record', due: '2026-11-14', done: false },
      { id: '2', title: 'DSA sheet', due: '2026-11-18', done: false },
      { id: '3', title: 'Done one', due: '2026-11-17', done: true },
      { id: '4', title: 'Far away', due: '2026-12-30', done: false },
    ];
    expect(dueAssignments(s, '2026-11-15').map((x) => [x.assignment.id, x.overdue])).toEqual([
      ['1', true],
      ['2', false],
    ]);
  });
});
