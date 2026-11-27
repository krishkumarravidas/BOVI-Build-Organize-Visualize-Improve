import {
  addSections,
  consistency,
  courseProgress,
  coursePace,
  markSession,
  newCourse,
  nextLesson,
  parseCurriculum,
  removeLesson,
  sanitizeCourses,
  sessionStatus,
  slotsOn,
  toggleLesson,
  unmarkedSessions,
  validateCourse,
  validateSlot,
  weeklyMinutes,
  type Course,
} from './courses';
import { migrateProjects, emptyProjects } from './projects';

let n = 0;
const id = () => `id${++n}`;
beforeEach(() => (n = 0));

describe('parseCurriculum', () => {
  it('reads sections, strips numbering and picks up durations', () => {
    const text = `Section 1: Introduction
1. Welcome to the course 3:12
2. Installing Unreal Engine (12:45)
Section 2 - Blueprints
Lecture 3 Variables and functions 1:02:10
- Events • 15 min
Casting 1h 5m

# Final project
Build a small game`;
    const s = parseCurriculum(text, id);
    expect(s.map((x) => x.title)).toEqual(['Introduction', 'Blueprints', 'Final project']);
    expect(s[0].lessons).toEqual([
      { id: expect.any(String), title: 'Welcome to the course', minutes: 3, done: false },
      { id: expect.any(String), title: 'Installing Unreal Engine', minutes: 13, done: false },
    ]);
    expect(s[1].lessons.map((l) => [l.title, l.minutes])).toEqual([
      ['Variables and functions', 62],
      ['Events', 15],
      ['Casting', 65],
    ]);
    expect(s[2].lessons[0]).toMatchObject({ title: 'Build a small game' });
    expect(s[2].lessons[0].minutes).toBeUndefined();
  });

  it('puts lessons without a section header in "Lessons", and skips empty sections', () => {
    const s = parseCurriculum('Intro\nSetup\nEmpty section:\n', id);
    expect(s).toHaveLength(1);
    expect(s[0].title).toBe('Lessons');
    expect(s[0].lessons.map((l) => l.title)).toEqual(['Intro', 'Setup']);
  });

  it('keeps titles that only look like numbers at the end', () => {
    const s = parseCurriculum('Top 10 tips\nUnreal Engine 5', id);
    expect(s[0].lessons.map((l) => l.title)).toEqual(['Top 10 tips', 'Unreal Engine 5']);
  });
});

function sample(): Course {
  let c = newCourse('UE5 Blueprints', 'c1', '2026-11-02');
  c = addSections(c, parseCurriculum('Basics:\nA 10m\nB 20m\nC 30m\nMore:\nD\nE', id));
  return { ...c, slots: [{ id: 'mon', day: 1, start: '19:00', end: '20:00' }, { id: 'thu', day: 4, start: '19:00', end: '19:45' }] };
}

describe('lessons and progress', () => {
  it('ticks lessons, finds the next one and counts progress', () => {
    let c = sample();
    const [a, b] = c.sections[0].lessons;
    c = toggleLesson(c, a.id, 1);
    c = toggleLesson(c, b.id, 2);
    expect(nextLesson(c)?.lesson.title).toBe('C');
    expect(courseProgress(c)).toMatchObject({ done: 2, total: 5, percent: 40, minutesDone: 30, minutesTotal: 60 });
    c = toggleLesson(c, a.id, 3);
    expect(courseProgress(c).done).toBe(1);
    expect(nextLesson(c)?.lesson.title).toBe('A');
  });

  it('removes a lesson and drops an emptied section', () => {
    let c = sample();
    for (const l of c.sections[1].lessons) c = removeLesson(c, l.id);
    expect(c.sections.map((s) => s.title)).toEqual(['Basics']);
  });
});

describe('schedule and sessions', () => {
  it('lists slots by weekday, only while active and after the start', () => {
    const c = sample();
    expect(slotsOn(c, '2026-11-16').map((s) => s.id)).toEqual(['mon']);
    expect(slotsOn(c, '2026-10-26')).toEqual([]);
    expect(slotsOn({ ...c, status: 'paused' }, '2026-11-16')).toEqual([]);
    expect(weeklyMinutes(c)).toBe(105);
  });

  it('marks sessions like attendance and finds unmarked ones', () => {
    let c = sample();
    const now = new Date(2026, 10, 19, 19, 30); // Thu 19 Nov, Thursday session has started
    expect(unmarkedSessions(c, now, 7).map((s) => `${s.date}:${s.slot.id}`)).toEqual(['2026-11-12:thu', '2026-11-16:mon', '2026-11-19:thu']);
    c = markSession(c, '2026-11-16', 'mon', 'done');
    c = markSession(c, '2026-11-12', 'thu', 'skipped');
    expect(sessionStatus(c, '2026-11-16', 'mon')).toBe('done');
    expect(unmarkedSessions(c, now, 7).map((s) => s.date)).toEqual(['2026-11-19']);
    expect(consistency(c)).toEqual({ done: 1, skipped: 1, percent: 50, streak: 1 });
    c = markSession(c, '2026-11-16', 'mon', null);
    expect(sessionStatus(c, '2026-11-16', 'mon')).toBeNull();
  });
});

describe('pace', () => {
  it('says how many lessons a week you need, and when you would finish', () => {
    let c: Course = { ...sample(), target: '2026-11-30' };
    const now = new Date(2026, 10, 16, 12);
    const recent = now.getTime() - 3 * 86_400_000;
    c = toggleLesson(c, c.sections[0].lessons[0].id, recent);
    c = toggleLesson(c, c.sections[0].lessons[1].id, recent);
    const p = coursePace(c, now);
    expect(p.remaining).toBe(3);
    expect(p.neededPerWeek).toBe(2); // 3 lessons, 2 weeks left
    expect(p.recentPerWeek).toBe(1); // 2 lessons in 14 days
    expect(p.projectedFinish).toBe('2026-12-07');
    expect(p.onTrack).toBe(false);
  });

  it('is done when nothing is left, and has no verdict without a target', () => {
    const c = sample();
    const all = c.sections.flatMap((s) => s.lessons).reduce((acc, l) => toggleLesson(acc, l.id, 1), c);
    expect(coursePace(all, new Date(2026, 10, 16)).remaining).toBe(0);
    expect(coursePace(c, new Date(2026, 10, 16)).onTrack).toBeNull();
    expect(coursePace(c, new Date(2026, 10, 16)).neededPerWeek).toBeNull();
  });
});

describe('validation and storage', () => {
  it('validates', () => {
    expect(validateCourse({ title: ' ', startedAt: '2026-11-01' })).toMatch(/name/);
    expect(validateCourse({ title: 'X', startedAt: '2026-11-01', target: '2026-10-01' })).toMatch(/before/);
    expect(validateSlot({ start: '19:00', end: '18:00' })).toMatch(/after/);
    expect(validateSlot({ start: '19:00', end: '20:00' })).toBeNull();
  });

  it('round-trips through project storage and repairs bad data', () => {
    const state = { ...emptyProjects(), courses: [sample()] };
    const loaded = migrateProjects(JSON.parse(JSON.stringify(state)))!;
    expect(loaded.courses?.[0].title).toBe('UE5 Blueprints');
    expect(loaded.courses?.[0].sections[0].lessons).toHaveLength(3);
    expect(migrateProjects({ ...emptyProjects() })!.courses).toBeUndefined();
    const fixed = sanitizeCourses([{ id: 'x', title: 'T' }, { nope: 1 }, null]);
    expect(fixed).toHaveLength(1);
    expect(fixed[0]).toMatchObject({ status: 'active', sections: [], slots: [], sessions: [] });
  });
});
