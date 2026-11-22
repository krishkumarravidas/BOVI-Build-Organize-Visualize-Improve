import { seedCollege, seedProjects } from '@/lib/__fixtures__/demo';

import { applyInbox, buildAgentSnapshot, matchSubject, parseInbox } from './agentSync';
import { emptyState } from './habits';

const NOW = new Date(2026, 10, 16, 10, 0); // Mon 16 Nov 2026
const TODAY = '2026-11-16';

const sources = () => ({ college: seedCollege(), habits: emptyState(), projects: seedProjects(), projectsLabel: 'Game dev', now: NOW });

describe('buildAgentSnapshot', () => {
  it('includes the worked-out answers Claude needs', () => {
    const s = buildAgentSnapshot(sources());
    expect(s.today).toBe(TODAY);
    expect(s.weekday).toBe('Mon');
    expect(s.projectsTabName).toBe('Game dev');
    expect(s.subjects.length).toBeGreaterThan(0);
    // Today's classes are in the resolved timetable, with attendance state.
    const todays = s.timetable.filter((c) => c.date === TODAY);
    expect(todays.length).toBeGreaterThan(0);
    expect(todays[0]).toHaveProperty('attendance');
    // Attendance per subject carries "can miss" numbers, not just raw counts.
    expect(s.attendance.subjects[0]).toHaveProperty('canMissNow');
    expect(s.attendance.target).toBe(seedCollege().attendanceTarget);
    // Only upcoming exams, soonest first, with readiness.
    expect(s.exams.every((e) => e.date >= TODAY)).toBe(true);
    for (let i = 1; i < s.exams.length; i++) expect(s.exams[i - 1].date <= s.exams[i].date).toBe(true);
    expect(s.exams[0]?.readiness).toBeDefined();
    // Survives a JSON round trip (that's how it travels).
    expect(JSON.parse(JSON.stringify(s)).today).toBe(TODAY);
  });

  it('covers a week back and two weeks ahead', () => {
    const s = buildAgentSnapshot(sources());
    const dates = s.timetable.map((c) => c.date).sort();
    expect(dates[0] >= '2026-11-09').toBe(true);
    expect(dates[dates.length - 1] <= '2026-11-30').toBe(true);
  });

  it('leaves out finished assignments and tasks', () => {
    const src = sources();
    src.college.assignments = [
      { id: 'a1', title: 'Open', due: '2026-11-20', done: false },
      { id: 'a2', title: 'Done', due: '2026-11-18', done: true },
    ];
    src.habits = { ...emptyState(), todos: [
      { id: 't1', title: 'Open task', date: TODAY, done: false },
      { id: 't2', title: 'Done task', date: TODAY, done: true },
    ] };
    const s = buildAgentSnapshot(src);
    expect(s.assignments.map((a) => a.title)).toEqual(['Open']);
    expect(s.tasks.map((t) => t.title)).toEqual(['Open task']);
  });
});

describe('parseInbox', () => {
  it('keeps well-formed items and drops junk', () => {
    const items = parseInbox([
      { id: '1', kind: 'task', title: 'Call lab TA', date: '2026-11-17' },
      { id: '2', kind: 'assignment', title: 'Lab record', due: '2026-11-20', subject: 'DSA' },
      { id: '3', kind: 'exam', series: 'IA2', date: '2026-12-01', subject: 'DSA', start: '09:30' },
      { id: '4', kind: 'idea', text: 'Rhythm game about trains' },
      { id: '5', kind: 'task' },
      { kind: 'idea', text: 'no id' },
      { id: '6', kind: 'delete-everything' },
      null,
    ]);
    expect(items.map((i) => i.id)).toEqual(['1', '2', '3', '4']);
    expect(parseInbox('nope')).toEqual([]);
  });
});

describe('matchSubject', () => {
  const subjects = seedCollege().subjects;
  it('matches name, short name or code, case-insensitively', () => {
    const s = subjects[0];
    expect(matchSubject(subjects, s.short.toLowerCase())?.id).toBe(s.id);
    expect(matchSubject(subjects, s.name.toUpperCase())?.id).toBe(s.id);
    if (s.code) expect(matchSubject(subjects, s.code)?.id).toBe(s.id);
    expect(matchSubject(subjects, 'Underwater basket weaving')).toBeUndefined();
    expect(matchSubject(subjects, '')).toBeUndefined();
  });
});

describe('applyInbox', () => {
  const state = () => ({ college: seedCollege(), habits: emptyState(), projects: seedProjects() });
  const subject = seedCollege().subjects[0];

  it('adds tasks, assignments, exams and ideas', () => {
    const items = parseInbox([
      { id: 'a', kind: 'task', title: 'Buy graph paper' },
      { id: 'b', kind: 'task', title: 'Viva prep', date: '2026-11-18', time: '17:00' },
      { id: 'c', kind: 'assignment', title: 'Problem set 4', due: '2026-11-21', subject: subject.short },
      { id: 'd', kind: 'exam', series: 'IA2', date: '2026-12-02', subject: subject.name, start: '10:00', end: '11:30' },
      { id: 'e', kind: 'idea', text: 'Puzzle game with mirrors' },
    ]);
    const r = applyInbox(state(), items, TODAY);
    expect(r.added).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(r.rejected).toEqual([]);
    const todos = r.habits.todos ?? [];
    expect(todos.find((t) => t.title === 'Buy graph paper')?.date).toBe(TODAY);
    expect(todos.find((t) => t.title === 'Viva prep')).toMatchObject({ date: '2026-11-18', time: '17:00', done: false });
    expect(r.college.assignments.find((a) => a.title === 'Problem set 4')?.subjectId).toBe(subject.id);
    expect(r.college.exams.find((e) => e.series === 'IA2' && e.date === '2026-12-02')).toMatchObject({ subjectId: subject.id, start: '10:00', end: '11:30' });
    expect(r.projects.ideas[0].text).toBe('Puzzle game with mirrors');
  });

  it('adds each item once, even if it is delivered twice', () => {
    const items = parseInbox([{ id: 'x', kind: 'task', title: 'Once' }]);
    const first = applyInbox(state(), items, TODAY);
    const second = applyInbox({ college: first.college, habits: first.habits, projects: first.projects }, items, TODAY);
    expect((second.habits.todos ?? []).filter((t) => t.title === 'Once')).toHaveLength(1);
    expect(second.handled).toEqual(['x']);
    expect(second.added).toEqual([]);
  });

  it('rejects bad dates and times but still marks them handled', () => {
    const items = parseInbox([
      { id: 'p', kind: 'task', title: 'Bad date', date: '2026-02-30' },
      { id: 'q', kind: 'exam', series: 'IA2', date: '2026-12-01', start: '9am' },
    ]);
    const r = applyInbox(state(), items, TODAY);
    expect(r.rejected.map((x) => x.id)).toEqual(['p', 'q']);
    expect(r.handled).toEqual(['p', 'q']);
    expect(r.added).toEqual([]);
  });

  it('keeps an unknown subject in the notes instead of guessing', () => {
    const r = applyInbox(state(), parseInbox([{ id: 'u', kind: 'assignment', title: 'Essay', due: '2026-11-25', subject: 'Philosophy' }]), TODAY);
    const a = r.college.assignments.find((x) => x.title === 'Essay');
    expect(a?.subjectId).toBeUndefined();
    expect(a?.notes).toContain('Philosophy');
  });
});
