import { seedCollege } from '@/lib/__fixtures__/demo';

import { EXAMPLE_ATTENDANCE, EXAMPLE_ATTENDANCE_JSON } from './attendanceFormat';
import { applyImport, matchSubject, parsePortal, planImport } from './attendanceImport';
import { resolveDay } from './college';
import { attendanceBySubject, markAttendance, semesterOutlook, subjectAttendance, unmarkedClasses } from './collegeStats';

let n = 0;
const id = () => `new${++n}`;

/** Fictional portal export matching the demo subjects (absences generated to match the counts). */
const subject = (subject_code: string, subject_name: string, conducted: number, present: number, remaining: number) => ({
  subject_code,
  subject_name,
  classes_conducted: conducted,
  classes_present: present,
  classes_absent: conducted - present,
  classes_remaining: remaining,
  absent_records: Array.from({ length: conducted - present }, (_, i) => ({ date: `2026-10-${String(10 + i).padStart(2, '0')}`, time: '09:25-10:20' })),
});
const SAMPLE = {
  source: 'Demo portal',
  generated_on: '2026-11-19',
  subjects: [
    subject('MA301', 'Probability and Statistics', 40, 36, 30),
    subject('CS302', 'Artificial Intelligence', 30, 18, 50),
    subject('CS303', 'Object Oriented Programming with Java', 44, 33, 35),
    subject('CS304', 'Digital Logic and Computer Organization', 20, 19, 22),
    subject('CS305', 'Data Structures and Algorithms', 25, 20, 24),
    subject('CSL306', 'Data Structures Laboratory', 8, 7, 26),
    subject('CSL307A', 'Data Visualization Laboratory', 10, 9, 8),
  ],
};

describe('portal attendance import', () => {
  const parsed = parsePortal(SAMPLE);

  it('parses the portal export (and the example shown in the app)', () => {
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.snapshot.asOf).toBe('2026-11-19');
    expect(parsed.snapshot.subjects).toHaveLength(7);
    expect(parsed.snapshot.subjects.find((s) => s.code === 'CS302')).toMatchObject({ conducted: 30, present: 18, remaining: 50 });
    expect(parsePortal(EXAMPLE_ATTENDANCE_JSON)).toMatchObject({ ok: true });
    expect(parsePortal(EXAMPLE_ATTENDANCE).ok && (parsePortal(EXAMPLE_ATTENDANCE) as { snapshot: { subjects: { absences: { date: string }[] }[] } }).snapshot.subjects[0].absences[0].date).toBe('2026-11-04');
    expect(parsePortal('nope')).toMatchObject({ ok: false });
    expect(parsePortal({ subjects: [] })).toMatchObject({ ok: false });
  });

  it('matches portal subjects to app subjects by code (and code family, e.g. CSL307A ↔ CSL307X)', () => {
    if (!parsed.ok) throw new Error();
    const rows = planImport(seedCollege(), parsed.snapshot, () => ({ present: 0, total: 0 }));
    expect(rows.map((r) => [r.portal.code, r.subject?.id])).toEqual([
      ['MA301', 'psml'],
      ['CS302', 'ai'],
      ['CS303', 'java'],
      ['CS304', 'ddco'],
      ['CS305', 'dsa'],
      ['CSL306', 'lab'],
      ['CSL307A', 'aec'],
    ]);
  });

  it('applies the figures and shows exactly the portal percentages', () => {
    if (!parsed.ok) throw new Error();
    const college = applyImport(seedCollege(), parsed.snapshot, id);
    expect(college.attendanceSyncedAt).toBe('2026-11-19');
    const { bySubject, overall } = attendanceBySubject(college);
    const pct = Object.fromEntries(bySubject.filter((s) => s.total).map((s) => [s.subject.id, Math.round((s.percent ?? 0) * 10) / 10]));
    expect(pct).toEqual({ psml: 90, ai: 60, java: 75, ddco: 95, dsa: 80, lab: 87.5, aec: 90 });
    expect(overall).toMatchObject({ present: 142, total: 177 });
    expect(college.subjects).toHaveLength(seedCollege().subjects.length); // nothing new created
  });

  it('adds classes marked after the portal date on top, and ignores marks before it', () => {
    if (!parsed.ok) throw new Error();
    let college = applyImport(seedCollege(), parsed.snapshot, id);
    const fri = resolveDay(college, '2026-11-20').find((o) => o.subject?.id === 'dsa');
    const mon = resolveDay(college, '2026-11-16').find((o) => o.subject?.id === 'dsa')!;
    college = markAttendance(college, mon, 'absent'); // before the snapshot: already counted by the portal
    if (fri) college = markAttendance(college, fri, 'present');
    const dsa = subjectAttendance(college, 'dsa');
    expect(dsa.present).toBe(20 + (fri ? 1 : 0));
    expect(dsa.total).toBe(25 + (fri ? 1 : 0));
    expect(dsa.remaining).toBe(24 - (fri ? 1 : 0));
    // Nothing the portal covers (on/before 19 Nov) is asked for again; subjects not on the portal still are.
    const toMark = unmarkedClasses(college, '2026-11-20', new Date(2026, 10, 20, 23));
    expect(toMark.filter((o) => college.attendanceBaseline![o.subject!.id]).every((o) => o.date > '2026-11-19')).toBe(true);
    expect(toMark.some((o) => !college.attendanceBaseline![o.subject!.id] && o.date <= '2026-11-19')).toBe(true);
  });

  it('works out the end-of-semester outlook', () => {
    // 15/29 with 55 left at 75%: (15+55)/84 = 83% best; slack = 70 − 63 = 7.
    expect(semesterOutlook(15, 29, 55, 75)).toEqual({ bestFinal: (70 / 84) * 100, canMissOfRemaining: 7 });
    expect(semesterOutlook(5, 29, 5, 75).canMissOfRemaining).toBeNull();
  });

  it('creates subjects that have no match (a brand-new user)', () => {
    if (!parsed.ok) throw new Error();
    const bare = { ...seedCollege(), subjects: [] };
    const college = applyImport(bare, parsed.snapshot, id);
    expect(college.subjects).toHaveLength(7);
    expect(college.subjects.find((s) => s.code === 'CSL306')?.short).toMatch(/Lab$/);
    expect(matchSubject(college.subjects, parsed.snapshot.subjects[0])?.code).toBe('MA301');
  });
});
