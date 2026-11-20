import { seedCollege, seedProjects } from '@/lib/__fixtures__/demo';

import { resolveDay } from './college';
import { attendanceFor } from './collegeStats';
import { addHabit, createHabit, emptyState, isCompleted, setCompleted } from './habits';
import { emptyProjects, startFocus } from './projects';
import { applyCollegeActions, applyHabitActions, applyProjectActions, parseWidgetActions } from './widgetActions';
import { buildWidgetData, type WidgetSources } from './widgetData';

const habits = () => {
  let s = addHabit(emptyState(), createHabit({ name: 'Read' }, '2026-11-01', 'a'));
  s = addHabit(s, createHabit({ name: 'Gym', reminderTime: '07:00' }, '2026-11-01', 'b'));
  return setCompleted(s, 'a', '2026-11-16', true);
};

const sources = (now: Date, patch: Partial<WidgetSources> = {}): WidgetSources => ({
  college: seedCollege(),
  habitState: habits(),
  projects: seedProjects(),
  events: [],
  mode: 'college',
  screenLimitMin: null,
  now,
  ...patch,
});

describe('buildWidgetData', () => {
  it('keeps all of today’s classes (for check-ins) but only upcoming ones on later days', () => {
    const now = new Date(2026, 10, 16, 9, 30); // Mon 09:30: DSA over, Java in progress
    const d = buildWidgetData(sources(now));
    const todays = d.classes.filter((c) => c.date === '2026-11-16');
    expect(todays.slice(0, 3).map((c) => [c.title, new Date(c.start).getHours(), c.room])).toEqual([
      ['DSA', 8, 'Room 204'],
      ['Java', 9, 'Room 204'],
      ['AI', 10, 'Room 204'],
    ]);
    expect(todays[0]).toMatchObject({ mark: null, cancelled: false });
    expect(todays[0].subjectId).toBeTruthy();
    expect(d.classes.filter((c) => c.date !== '2026-11-16').every((c) => c.end > now.getTime() && !c.cancelled)).toBe(true);
    // Custom titles (tutorials, labs) are kept as-is.
    expect(d.classes.some((c) => c.title === 'OOPS Tutorial')).toBe(true);
  });

  it('includes exams with syllabus progress, habits with items, attendance and projects', () => {
    const now = new Date(2026, 10, 16, 10, 0);
    const d = buildWidgetData(sources(now));
    expect(d.exams[0]).toMatchObject({ title: 'Artificial Intelligence IA1', timed: true });
    expect(d.exams[0].topicsTotal).toBeGreaterThan(0);
    expect(d.exams.some((e) => e.title.startsWith('Probability'))).toBe(false); // 09:30 exam already started
    expect(d.habits).toMatchObject({ day: '2026-11-16', done: 1, total: 2 });
    expect(d.habits.items.map((h) => [h.name, h.done])).toEqual([
      ['Gym', false], // timed habits first
      ['Read', true],
    ]);
    expect(d.habitsNext).toMatchObject({ day: '2026-11-17', done: 0, total: 2 });
    expect(d.attendance.target).toBe(75);
    expect(d.attendance.subjects.length).toBeGreaterThan(0);
    expect(d.projects.length).toBeGreaterThan(0);
    expect(d.focus).toBeNull();
    expect(d.week.map((w) => w.day)).toEqual(['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22']);
    expect(d.week[0]).toEqual({ day: '2026-11-16', done: 1, total: 2 });
  });

  it('covers today’s midnight to 60 h ahead on the mini dial, with rings and colours', () => {
    const now = new Date(2026, 10, 16, 9, 30);
    const d = buildWidgetData(sources(now));
    expect(d.dial.length).toBeGreaterThan(0);
    const midnight = new Date(2026, 10, 16).getTime();
    expect(d.dial.every((i) => i.end >= midnight && i.start <= now.getTime() + 60 * 3_600_000)).toBe(true);
    // Tomorrow's classes are there for turning the widget forward.
    expect(d.dial.some((i) => i.start >= new Date(2026, 10, 17).getTime())).toBe(true);
    expect(d.dial.find((i) => i.title === 'DSA')).toBeTruthy(); // already over today, still drawable when turned back
    expect(d.dial.find((i) => i.title === 'Java')).toMatchObject({ ring: 'college', point: false });
    expect(d.dial.every((i) => /^#[0-9A-Fa-f]{6}$/.test(i.color))).toBe(true);
  });

  it('reports the running focus session', () => {
    const now = new Date(2026, 10, 16, 20, 0);
    const p = startFocus(seedProjects(), 'x', 25, now.getTime() - 60_000);
    expect(buildWidgetData(sources(now, { projects: p })).focus).toEqual({ projectId: 'x', startedAt: now.getTime() - 60_000, minutes: 25 });
  });
});

describe('widget actions', () => {
  it('parses the native queue and drops malformed entries', () => {
    const json = JSON.stringify([
      { type: 'habit', habitId: 'a', day: '2026-11-16', done: false },
      { type: 'habit', habitId: 'a' },
      { type: 'attend', date: '2026-11-16', key: 'k', status: 'present' },
      { type: 'attend', date: '2026-11-16', key: 'k', status: 'maybe' },
      { type: 'focusStart', minutes: 25, at: 5 },
      { type: 'focusStop', at: 9 },
      { type: 'nope' },
      null,
    ]);
    expect(parseWidgetActions(json).map((a) => a.type)).toEqual(['habit', 'attend', 'focusStart', 'focusStop']);
    expect(parseWidgetActions('not json')).toEqual([]);
    expect(parseWidgetActions(null)).toEqual([]);
  });

  it('replays habit ticks idempotently and ignores unknown habits', () => {
    const s = applyHabitActions(habits(), [
      { type: 'habit', habitId: 'b', day: '2026-11-16', done: true },
      { type: 'habit', habitId: 'b', day: '2026-11-16', done: true },
      { type: 'habit', habitId: 'a', day: '2026-11-16', done: false },
      { type: 'habit', habitId: 'zzz', day: '2026-11-16', done: true },
    ]);
    expect(isCompleted(s, 'b', '2026-11-16')).toBe(true);
    expect(isCompleted(s, 'a', '2026-11-16')).toBe(false);
    expect(s.completions.zzz).toBeUndefined();
  });

  it('marks attendance once (never overriding the app) and completes assignments', () => {
    const college = seedCollege();
    const occ = resolveDay(college, '2026-11-16').find((o) => o.subject)!;
    const withAssignment = { ...college, assignments: [{ id: 'as1', title: 'Lab record', due: '2026-11-18', done: false }] };
    const s = applyCollegeActions(withAssignment, [
      { type: 'attend', date: '2026-11-16', key: occ.key, status: 'present' },
      { type: 'attend', date: '2026-11-16', key: occ.key, status: 'absent' },
      { type: 'attend', date: '2026-11-16', key: 'missing', status: 'present' },
      { type: 'assignment', id: 'as1' },
    ]);
    expect(attendanceFor(s, '2026-11-16', occ.key)).toBe('present');
    expect(s.attendance).toHaveLength(1);
    expect(s.attendance[0].subjectId).toBe(occ.subject!.id);
    expect(s.assignments[0].done).toBe(true);
  });

  it('replays focus start/stop with the widget’s timestamps', () => {
    const base = { ...emptyProjects(), projects: seedProjects().projects };
    const pid = base.projects[0].id;
    let n = 0;
    const id = () => `s${++n}`;
    const t0 = 1_000_000;
    let s = applyProjectActions(base, [{ type: 'focusStart', projectId: pid, minutes: 25, at: t0 }], id);
    expect(s.activeFocus).toEqual({ projectId: pid, startedAt: t0, minutes: 25 });
    s = applyProjectActions(s, [{ type: 'focusStop', at: t0 + 10 * 60_000 }], id);
    expect(s.activeFocus).toBeNull();
    expect(s.focus).toEqual([{ id: 's1', projectId: pid, start: t0, minutes: 10 }]);
    // Starting while one runs saves the old one first; unknown projects fall back to "no project".
    s = applyProjectActions(s, [
      { type: 'focusStart', projectId: pid, minutes: 25, at: t0 + 20 * 60_000 },
      { type: 'focusStart', projectId: 'gone', minutes: 45, at: t0 + 30 * 60_000 },
    ], id);
    expect(s.focus.map((f) => f.minutes)).toEqual([10, 10]);
    expect(s.activeFocus).toEqual({ projectId: undefined, startedAt: t0 + 30 * 60_000, minutes: 45 });
    // A stop timestamped before the running session started is stale.
    expect(applyProjectActions(s, [{ type: 'focusStop', at: t0 }], id).activeFocus).not.toBeNull();
  });
});
