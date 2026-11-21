import type { AgendaEvent } from './agenda';
import { resolveDay, subjectName, type CollegeState } from './college';
import { attendanceFor, subjectAttendance, topicProgress } from './collegeStats';
import { dayProgress } from './calendarLayout';
import { addDays, atTime, fromDateKey, toDateKey } from './dates';
import { habitsForDay, isCompleted } from './habits';
import { weekStart } from './insights';
import { thisWeek, weekTasks } from './gamedev';
import { STATUS_ORDER, nextMilestone, sortedLog, type ProjectsState } from './projects';
import { ringFor } from './radial';
import type { AppMode } from './settings';
import { buildTimeline } from './timeline';
import type { DateKey, HabitState } from './types';

/**
 * Snapshot the home-screen widgets render from (stored natively as JSON). Times are epoch ms; widgets work
 * out "now / next" themselves at draw time so the snapshot stays useful while the app is closed.
 */
export interface WidgetData {
  version: 2;
  generatedAt: number;
  mode: AppMode;
  /** The user's name for the second tab ("Projects", "Game dev"…). */
  projectsLabel: string;
  today: DateKey;
  /** Today's classes (all, including past and cancelled) plus the next 6 days' remaining ones. */
  classes: {
    key: string;
    date: DateKey;
    start: number;
    end: number;
    title: string;
    room: string;
    subjectId?: string;
    color?: string;
    cancelled: boolean;
    changed: boolean;
    mark: 'present' | 'absent' | null;
  }[];
  exams: { at: number; timed: boolean; title: string; topicsDone: number; topicsTotal: number }[];
  habits: { day: DateKey; done: number; total: number; items: { id: string; name: string; time?: string; done: boolean }[] };
  /** Tomorrow's habits, so the habits widget keeps working after midnight before the app is opened. */
  habitsNext: { day: DateKey; done: number; total: number; items: { id: string; name: string; time?: string; done: boolean }[] };
  attendance: { target: number; subjects: { id: string; short: string; color: string; present: number; total: number }[] };
  assignments: { id: string; title: string; subject: string; due: DateKey }[];
  projects: { id: string; name: string; next?: string; done: number; total: number; lastLog?: DateKey; focusTodayMin: number }[];
  focus: { projectId?: string; startedAt: number; minutes: number } | null;
  /** This week's planned game-dev tasks. */
  weekPlan: { done: number; total: number };
  /** Default plan for a session started from the widget (the widget lets you cycle 25/45/60). */
  focusMinutes: number;
  /** Timed items from today's midnight to now+60 h, so the dial widget can be turned across days. */
  dial: { start: number; end: number; ring: 'life' | 'college' | 'events'; title: string; color: string; point: boolean; done: boolean }[];
  /** Monday–Sunday of the current week. */
  week: { day: DateKey; done: number; total: number }[];
  screenLimitMin: number | null;
}

export interface WidgetSources {
  college: CollegeState;
  habitState: HabitState;
  projects: ProjectsState;
  events: readonly AgendaEvent[];
  mode: AppMode;
  screenLimitMin: number | null;
  now: Date;
  projectsLabel?: string;
}

const DAYS_AHEAD = 7;
const COLORS = { exam: '#EE7A74', event: '#D6D6D6', life: '#7CC4A1', class: '#BDBDBD' };

export function buildWidgetData({ college, habitState, projects, events, mode, screenLimitMin, now, projectsLabel = 'Projects' }: WidgetSources): WidgetData {
  const today = toDateKey(now);
  const nowMs = now.getTime();

  const classes: WidgetData['classes'] = [];
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const day = addDays(today, i);
    for (const o of resolveDay(college, day)) {
      const cancelled = o.status === 'cancelled';
      if (i > 0 && (cancelled || o.end.getTime() <= nowMs)) continue;
      classes.push({
        key: o.key,
        date: o.date,
        start: o.start.getTime(),
        end: o.end.getTime(),
        title: o.subject && o.title === o.subject.name ? o.subject.short : o.title,
        room: o.room,
        subjectId: o.subject?.id,
        color: o.subject?.color,
        cancelled,
        changed: o.status === 'changed' || o.status === 'extra',
        mark: o.subject ? (attendanceFor(college, o.date, o.key) ?? null) : null,
      });
    }
  }
  classes.sort((a, b) => a.start - b.start);

  const exams = college.exams
    .filter((e) => e.date >= today)
    .map((e) => {
      const t = topicProgress(e);
      return {
        at: atTime(e.date, e.start ?? '00:00').getTime(),
        timed: !!e.start,
        title: `${subjectName(college, e.subjectId, e.title)} ${e.series}`,
        topicsDone: t.done,
        topicsTotal: t.total,
      };
    })
    .filter((e) => !e.timed || e.at > nowMs)
    .sort((a, b) => a.at - b.at)
    .slice(0, 5);

  const habitsOn = (day: DateKey) => {
    const items = habitsForDay(habitState, day)
      .slice()
      .sort((a, b) => (a.reminderTime ?? '99').localeCompare(b.reminderTime ?? '99'))
      .map((h) => ({ id: h.id, name: h.name, time: h.reminderTime, done: isCompleted(habitState, h.id, day) }));
    return { day, done: items.filter((h) => h.done).length, total: items.length, items };
  };

  const attendance = {
    target: college.attendanceTarget,
    subjects: college.subjects.map((s) => {
      const c = subjectAttendance(college, s.id);
      return { id: s.id, short: s.short || s.name, color: s.color, present: c.present, total: c.total };
    }),
  };

  const assignments = college.assignments
    .filter((a) => !a.done && a.due <= addDays(today, 14))
    .sort((a, b) => a.due.localeCompare(b.due))
    .slice(0, 6)
    .map((a) => ({ id: a.id, title: a.title, subject: a.subjectId ? subjectName(college, a.subjectId) : '', due: a.due }));

  const dayStartMs = fromDateKey(today).getTime();
  const focusToday = new Map<string, number>();
  for (const s of projects.focus) {
    if (s.start >= dayStartMs && s.projectId) focusToday.set(s.projectId, (focusToday.get(s.projectId) ?? 0) + s.minutes);
  }
  const projectList = projects.projects
    .filter((p) => p.status !== 'done' && p.status !== 'parked')
    .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status))
    .slice(0, 10)
    .map((p) => ({
      id: p.id,
      name: p.name,
      next: nextMilestone(p)?.title ?? p.nextStep,
      done: p.milestones.filter((m) => m.done).length,
      total: p.milestones.length,
      lastLog: sortedLog(p)[0]?.date,
      focusTodayMin: focusToday.get(p.id) ?? 0,
    }));

  // Mini dial: from today's midnight to 60 h ahead (the widget's ◀ ▶ turn a 12 h window through it).
  const from = fromDateKey(today).getTime();
  const to = nowMs + 60 * 60 * 60_000;
  const dial: WidgetData['dial'] = [];
  for (const day of [today, addDays(today, 1), addDays(today, 2), addDays(today, 3)]) {
    const tl = buildTimeline(day, { events: events.filter((e) => !e.allDay), blocks: habitState.blocks, habitState, college });
    for (const item of tl.items) {
      const start = item.start.getTime();
      const end = 'end' in item ? item.end.getTime() : start;
      if (end < from || start > to) continue;
      const color = item.kind === 'class' ? (item.color ?? COLORS.class) : item.kind === 'exam' ? COLORS.exam : item.kind === 'event' ? COLORS.event : COLORS.life;
      const title = item.kind === 'class' && item.short ? item.short : item.title;
      dial.push({ start, end, ring: ringFor(item), title, color, point: item.kind === 'habit', done: 'done' in item ? item.done : false });
    }
  }
  dial.sort((a, b) => a.start - b.start);

  const monday = weekStart(today);
  const week = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(monday, i);
    return { day, ...dayProgress(habitState, college, day) };
  });

  return {
    version: 2,
    generatedAt: nowMs,
    mode,
    projectsLabel,
    today,
    classes: classes.slice(0, 60),
    exams,
    habits: habitsOn(today),
    habitsNext: habitsOn(addDays(today, 1)),
    attendance,
    assignments,
    projects: projectList,
    focus: projects.activeFocus ? { projectId: projects.activeFocus.projectId, startedAt: projects.activeFocus.startedAt, minutes: projects.activeFocus.minutes } : null,
    focusMinutes: 25,
    weekPlan: (() => {
      const planned = weekTasks(projects, thisWeek(today));
      return { done: planned.filter((x) => x.task.done).length, total: planned.length };
    })(),
    dial: dial.slice(0, 160),
    week,
    screenLimitMin,
  };
}
