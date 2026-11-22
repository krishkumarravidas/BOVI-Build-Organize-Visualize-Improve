import { seedCollege } from '@/lib/__fixtures__/demo';

import { emptyCollege, inSemester, migrateCollege, resolveDay, type CollegeState } from './college';
import { classHistory } from './attendanceHistory';
import {
  currentSemester,
  deleteSemester,
  nextSemesterName,
  semesterProgress,
  semesterSummary,
  startNewSemester,
  switchSemester,
  updateSemesterInfo,
  validateSemester,
} from './semesters';

const withMarks = (): CollegeState => {
  const c = seedCollege();
  return { ...c, attendance: [{ date: '2026-11-16', key: `s:${c.slots[0].id}`, subjectId: c.slots[0].subjectId, status: 'present' }] };
};

describe('semester dates', () => {
  it('has no classes outside the semester', () => {
    const c = updateSemesterInfo(seedCollege(), { name: 'Sem 3', start: '2026-08-01', end: '2026-11-30' });
    const monday = c.slots.find((s) => s.day === 1)!;
    expect(monday).toBeDefined();
    expect(resolveDay(c, '2026-11-16').length).toBeGreaterThan(0);
    expect(resolveDay(c, '2026-12-07')).toEqual([]);
    expect(resolveDay(c, '2026-07-27')).toEqual([]);
    expect(inSemester(c, '2026-11-30')).toBe(true);
    expect(inSemester(c, '2026-12-01')).toBe(false);
  });

  it('attendance history stops at the semester start', () => {
    const c = updateSemesterInfo(seedCollege(), { start: '2026-11-10' });
    expect(classHistory(c, new Date(2026, 10, 18, 20), 60).every((r) => r.date >= '2026-11-10')).toBe(true);
  });

  it('without dates, every day counts (existing data keeps working)', () => {
    const c = seedCollege();
    expect(c.semester).toBeUndefined();
    expect(currentSemester(c).name).toBe('This semester');
    expect(inSemester(c, '1999-01-01')).toBe(true);
  });
});

describe('startNewSemester', () => {
  it('stores the old semester and starts empty', () => {
    const old = updateSemesterInfo(withMarks(), { name: 'Semester 3' });
    const next = startNewSemester(old, { name: 'Semester 4', start: '2027-01-05', keepSubjects: false, keepTimetable: false }, 'sem4');
    expect(next.semester).toEqual({ id: 'sem4', name: 'Semester 4', start: '2027-01-05' });
    expect(next.subjects).toEqual([]);
    expect(next.slots).toEqual([]);
    expect(next.attendance).toEqual([]);
    expect(next.exams).toEqual([]);
    expect(next.attendanceBaseline).toBeUndefined();
    // Settings that aren't per-semester stay.
    expect(next.attendanceTarget).toBe(old.attendanceTarget);
    expect(next.profile).toBe(old.profile);
    expect(next.pastSemesters?.[0].name).toBe('Semester 3');
    expect(next.pastSemesters?.[0].data.attendance).toHaveLength(1);
    expect(next.pastSemesters?.[0].data.subjects).toEqual(old.subjects);
  });

  it('can keep the subjects and timetable, with fresh attendance', () => {
    const old = withMarks();
    const next = startNewSemester(old, { name: 'Sem 4', keepSubjects: true, keepTimetable: true }, 'sem4');
    expect(next.subjects).toEqual(old.subjects);
    expect(next.slots).toEqual(old.slots);
    expect(next.attendance).toEqual([]);
    const onlySubjects = startNewSemester(old, { name: 'Sem 4', keepSubjects: true, keepTimetable: false }, 'sem4');
    expect(onlySubjects.slots).toEqual([]);
    expect(startNewSemester(old, { name: 'Sem 4', keepSubjects: false, keepTimetable: true }, 'x').slots).toEqual([]);
  });
});

describe('switchSemester', () => {
  it('swaps semesters both ways without losing anything', () => {
    const s3 = updateSemesterInfo(withMarks(), { name: 'Semester 3', start: '2026-08-01' });
    const s4 = startNewSemester(s3, { name: 'Semester 4', keepSubjects: false, keepTimetable: false }, 'sem4');
    const s4withExam = { ...s4, exams: [{ id: 'e', series: 'IA1', date: '2027-02-01' }] };
    const back = switchSemester(s4withExam, s3.semester!.id);
    expect(back.semester?.name).toBe('Semester 3');
    expect(back.subjects).toEqual(s3.subjects);
    expect(back.attendance).toEqual(s3.attendance);
    expect(back.exams).toEqual(s3.exams);
    expect(back.pastSemesters?.map((p) => p.name)).toEqual(['Semester 4']);
    expect(back.pastSemesters?.[0].data.exams).toHaveLength(1);
    const again = switchSemester(back, 'sem4');
    expect(again.semester?.name).toBe('Semester 4');
    expect(again.exams).toHaveLength(1);
    expect(again.subjects).toEqual([]);
  });

  it('ignores unknown ids', () => {
    const c = seedCollege();
    expect(switchSemester(c, 'nope')).toBe(c);
  });
});

describe('storage', () => {
  it('survives a save/load round trip, including stored semesters', () => {
    const s4 = startNewSemester(updateSemesterInfo(withMarks(), { name: 'Semester 3', end: '2026-12-15' }), { name: 'Semester 4', start: '2027-01-05', keepSubjects: true, keepTimetable: false }, 'sem4');
    const loaded = migrateCollege(JSON.parse(JSON.stringify(s4)))!;
    expect(loaded.semester).toEqual(s4.semester);
    expect(loaded.pastSemesters?.[0].name).toBe('Semester 3');
    expect(loaded.pastSemesters?.[0].end).toBe('2026-12-15');
    expect(loaded.pastSemesters?.[0].data.attendance).toEqual(s4.pastSemesters![0].data.attendance);
  });

  it('drops malformed stored semesters', () => {
    const loaded = migrateCollege({ ...emptyCollege(), semester: { id: 1 }, pastSemesters: [{ id: 'a' }, { id: 'b', name: 'B', data: 'x' }, { id: 'c', name: 'C', data: { subjects: [] } }] })!;
    expect(loaded.semester).toBeUndefined();
    expect(loaded.pastSemesters?.map((p) => p.id)).toEqual(['c']);
  });

  it('deletes a stored semester', () => {
    const s = startNewSemester(seedCollege(), { name: 'Sem 4', keepSubjects: false, keepTimetable: false }, 'sem4');
    expect(deleteSemester(s, s.pastSemesters![0].id).pastSemesters).toEqual([]);
  });
});

describe('helpers', () => {
  it('validates names and dates', () => {
    expect(validateSemester({ name: ' ' })).toMatch(/name/);
    expect(validateSemester({ name: 'S', start: '2027-02-01', end: '2027-01-01' })).toMatch(/before/);
    expect(validateSemester({ name: 'S', start: '2027-01-01', end: '2027-05-01' })).toBeNull();
  });

  it('suggests the next name', () => {
    expect(nextSemesterName('Semester 4')).toBe('Semester 5');
    expect(nextSemesterName('Sem 3 (CSE)')).toBe('Sem 3 (CSE)'.replace('3', '4'));
    expect(nextSemesterName('Odd sem')).toBe('Next semester');
  });

  it('works out the week of the semester', () => {
    const info = { id: 'x', name: 'S', start: '2026-11-02', end: '2026-11-29' };
    expect(semesterProgress(info, '2026-11-16')).toEqual({ week: 3, weeks: 4, daysLeft: 13, status: 'during' });
    expect(semesterProgress(info, '2026-10-30')?.status).toBe('before');
    expect(semesterProgress(info, '2026-12-01')?.status).toBe('after');
    expect(semesterProgress({ id: 'x', name: 'S' }, '2026-11-16')).toBeNull();
  });

  it('summarises a stored semester', () => {
    const s = startNewSemester(withMarks(), { name: 'Sem 4', keepSubjects: false, keepTimetable: false }, 'sem4');
    const sum = semesterSummary(s.pastSemesters![0].data, 75);
    expect(sum.subjects).toBe(seedCollege().subjects.length);
    expect(sum.classesMarked).toBeGreaterThanOrEqual(1);
  });
});
