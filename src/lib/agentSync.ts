/**
 * Claude connector: what BOVI sends to your sync server (a read-only "agent snapshot" with the answers
 * already worked out: today's classes, how many you can miss, exam readiness...), and how it applies
 * the items Claude adds (tasks, assignments, exams, ideas) when they come back.
 *
 * The server stores the snapshot and queues additions; it never needs BOVI's logic. Pure functions only.
 */
import { resolveDay, subjectName, type CollegeState, type Subject } from './college';
import { attendanceBySubject, attendanceFor, semesterOutlook, topicProgress } from './collegeStats';
import { addDays, daysBetween, isValidDateKey, toDateKey, weekdayOf } from './dates';
import { habitsForDay, isCompleted } from './habits';
import { addIdea, nextMilestone, sortedLog, type ProjectsState } from './projects';
import { examReadiness } from './readiness';
import { currentSemester, semesterProgress } from './semesters';
import { upsertTodo } from './todos';
import type { DateKey, HabitState } from './types';

export const SNAPSHOT_VERSION = 1;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const PAST_DAYS = 7;
const AHEAD_DAYS = 14;

export interface SnapshotSources {
  college: CollegeState;
  habits: HabitState;
  projects: ProjectsState;
  projectsLabel: string;
  now: Date;
}

export function buildAgentSnapshot({ college, habits, projects, projectsLabel, now }: SnapshotSources) {
  const today = toDateKey(now);
  const nowMs = now.getTime();
  const subjectLabel = (id?: string) => (id ? college.subjects.find((s) => s.id === id)?.name : undefined);

  const timetable = [];
  for (let i = -PAST_DAYS; i <= AHEAD_DAYS; i++) {
    const date = addDays(today, i);
    for (const o of resolveDay(college, date)) {
      timetable.push({
        date,
        weekday: WEEKDAYS[weekdayOf(date)],
        start: o.startText,
        end: o.endText,
        subject: o.subject?.name ?? null,
        title: o.title,
        room: o.room || null,
        status: o.status,
        attendance: o.subject ? (attendanceFor(college, date, o.key) ?? null) : null,
      });
    }
  }

  const att = attendanceBySubject(college);
  const attendance = {
    target: college.attendanceTarget,
    overall: { present: att.overall.present, total: att.overall.total, percent: round(att.overall.percent) },
    subjects: att.bySubject.map((s) => {
      const outlook = s.remaining !== null ? semesterOutlook(s.present, s.total, s.remaining, college.attendanceTarget) : null;
      return {
        subject: s.subject.name,
        short: s.subject.short,
        present: s.present,
        total: s.total,
        percent: round(s.percent),
        canMissNow: s.canSkip,
        mustAttendToReachTarget: Number.isFinite(s.mustAttend) ? s.mustAttend : null,
        classesLeftThisSemester: s.remaining,
        canMissOfRemaining: outlook?.canMissOfRemaining ?? null,
        bestPossibleFinalPercent: outlook ? round(outlook.bestFinal) : null,
        portalCountsAsOf: s.asOf,
      };
    }),
  };

  const exams = college.exams
    .filter((e) => e.date >= today)
    .sort((a, b) => (a.date + (a.start ?? '')).localeCompare(b.date + (b.start ?? '')))
    .map((e) => {
      const t = topicProgress(e);
      const r = examReadiness(college, projects, e, today, nowMs);
      return {
        id: e.id,
        subject: subjectLabel(e.subjectId) ?? null,
        series: e.series,
        title: subjectName(college, e.subjectId, e.title),
        date: e.date,
        start: e.start ?? null,
        end: e.end ?? null,
        room: e.room ?? null,
        daysLeft: daysBetween(today, e.date),
        syllabus: e.syllabus ?? null,
        topics: { done: t.done, total: t.total, notDone: (e.topics ?? []).filter((x) => !x.done).map((x) => x.title) },
        readiness: { score: r.score === null ? null : Math.round(r.score), verdict: r.verdict, tip: r.tip },
      };
    });

  const assignments = college.assignments
    .filter((a) => !a.done)
    .sort((a, b) => a.due.localeCompare(b.due))
    .map((a) => ({ id: a.id, title: a.title, subject: subjectLabel(a.subjectId) ?? null, due: a.due, overdue: a.due < today, notes: a.notes ?? null }));

  const tasks = (habits.todos ?? [])
    .filter((t) => !t.done && t.date >= addDays(today, -30))
    .sort((a, b) => (a.date + (a.time ?? '99')).localeCompare(b.date + (b.time ?? '99')))
    .map((t) => ({ id: t.id, title: t.title, date: t.date, time: t.time ?? null, overdue: t.date < today, notes: t.notes ?? null }));

  const habitsToday = habitsForDay(habits, today).map((h) => ({ name: h.name, time: h.reminderTime ?? null, done: isCompleted(habits, h.id, today) }));

  const weekAgo = nowMs - 7 * 86_400_000;
  const projectList = projects.projects
    .filter((p) => p.status !== 'done')
    .map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      summary: p.summary ?? null,
      nextStep: p.nextStep ?? null,
      nextMilestone: nextMilestone(p)?.title ?? null,
      openMilestones: p.milestones.filter((m) => !m.done).map((m) => ({ title: m.title, due: m.due ?? null })),
      openTasks: p.tasks.filter((t) => !t.done).slice(0, 15).map((t) => t.title),
      deadline: p.deadline ?? null,
      lastDevlog: sortedLog(p)[0]?.date ?? null,
      focusMinutesLast7Days: projects.focus.filter((f) => f.projectId === p.id && f.start >= weekAgo).reduce((a, f) => a + f.minutes, 0),
    }));

  return {
    version: SNAPSHOT_VERSION,
    generatedAt: now.toISOString(),
    today,
    weekday: WEEKDAYS[weekdayOf(today)],
    timeZone: timeZone(),
    projectsTabName: projectsLabel,
    semester: (() => {
      const sem = currentSemester(college);
      const p = semesterProgress(sem, today);
      return { name: sem.name, start: sem.start ?? null, end: sem.end ?? null, week: p?.status === 'during' ? p.week : null, weeks: p?.weeks ?? null, status: p?.status ?? null, otherSemesters: (college.pastSemesters ?? []).map((x) => x.name) };
    })(),
    subjects: college.subjects.map((s) => ({ name: s.name, short: s.short, code: s.code ?? null })),
    weeklyTimetable: college.slots
      .slice()
      .sort((a, b) => a.day - b.day || a.start.localeCompare(b.start))
      .map((s) => ({ day: WEEKDAYS[s.day], start: s.start, end: s.end, subject: subjectLabel(s.subjectId) ?? null, title: s.title ?? null, room: s.room || college.defaultRoom || null })),
    timetable,
    attendance,
    exams,
    assignments,
    tasks,
    habitsToday,
    events: college.events.filter((e) => e.endDate >= today).map((e) => ({ title: e.title, startDate: e.startDate, endDate: e.endDate, note: e.note ?? null })),
    studySessions: college.study.filter((s) => s.date >= today).map((s) => ({ title: s.title, date: s.date, start: s.start, end: s.end, done: s.done })),
    marks: college.marks.map((m) => ({ subject: subjectLabel(m.subjectId) ?? null, label: m.label, scored: m.scored, outOf: m.outOf })),
    projects: projectList,
    ideas: projects.ideas.slice(0, 50).map((i) => ({ text: i.text, date: i.createdAt })),
  };
}

export type AgentSnapshot = ReturnType<typeof buildAgentSnapshot>;

const round = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);

function timeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}

// ---------- items added by Claude ----------

export type InboxItem =
  | { id: string; kind: 'task'; title: string; date?: string; time?: string; notes?: string }
  | { id: string; kind: 'assignment'; title: string; due: string; subject?: string; notes?: string }
  | { id: string; kind: 'exam'; series: string; date: string; subject?: string; title?: string; start?: string; end?: string; room?: string; syllabus?: string }
  | { id: string; kind: 'idea'; text: string };

/** Keeps only well-formed items (the server is trusted, but the app never applies junk). */
export function parseInbox(value: unknown): InboxItem[] {
  if (!Array.isArray(value)) return [];
  const str = (v: unknown, max = 500) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);
  const out: InboxItem[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const id = str(r.id, 80);
    if (!id) continue;
    if (r.kind === 'task' && str(r.title)) out.push({ id, kind: 'task', title: str(r.title)!, date: str(r.date, 10), time: str(r.time, 5), notes: str(r.notes, 2000) });
    else if (r.kind === 'assignment' && str(r.title) && str(r.due, 10))
      out.push({ id, kind: 'assignment', title: str(r.title)!, due: str(r.due, 10)!, subject: str(r.subject, 120), notes: str(r.notes, 2000) });
    else if (r.kind === 'exam' && str(r.series, 60) && str(r.date, 10))
      out.push({ id, kind: 'exam', series: str(r.series, 60)!, date: str(r.date, 10)!, subject: str(r.subject, 120), title: str(r.title), start: str(r.start, 5), end: str(r.end, 5), room: str(r.room, 60), syllabus: str(r.syllabus, 4000) });
    else if (r.kind === 'idea' && str(r.text, 1000)) out.push({ id, kind: 'idea', text: str(r.text, 1000)! });
  }
  return out;
}

/** Finds a subject by name, short name or code (case-insensitive), then by partial name. */
export function matchSubject(subjects: readonly Subject[], query?: string): Subject | undefined {
  const q = query?.trim().toLowerCase();
  if (!q) return undefined;
  const exact = subjects.find((s) => [s.name, s.short, s.code ?? ''].some((v) => v.toLowerCase() === q));
  if (exact) return exact;
  const partial = subjects.filter((s) => s.name.toLowerCase().includes(q) || q.includes(s.name.toLowerCase()));
  return partial.length === 1 ? partial[0] : undefined;
}

export interface InboxResult {
  college: CollegeState;
  habits: HabitState;
  projects: ProjectsState;
  /** Every item handled (added, skipped as duplicate, or rejected) — tell the server to drop them. */
  handled: string[];
  added: string[];
  rejected: { id: string; reason: string }[];
}

/**
 * Applies Claude's additions. Created items take the inbox id (prefixed), so an item delivered twice
 * (e.g. the acknowledgement was lost) is only added once.
 */
export function applyInbox(state: { college: CollegeState; habits: HabitState; projects: ProjectsState }, items: readonly InboxItem[], today: DateKey): InboxResult {
  let { college, habits, projects } = state;
  const handled: string[] = [];
  const added: string[] = [];
  const rejected: InboxResult['rejected'] = [];
  const reject = (id: string, reason: string) => rejected.push({ id, reason });

  for (const item of items) {
    handled.push(item.id);
    const id = `claude-${item.id}`;
    if (item.kind === 'task') {
      const date = item.date ?? today;
      if (!isValidDateKey(date)) { reject(item.id, `bad date ${date}`); continue; }
      if (item.time && !HHMM.test(item.time)) { reject(item.id, `bad time ${item.time}`); continue; }
      if ((habits.todos ?? []).some((t) => t.id === id)) continue;
      habits = upsertTodo(habits, { id, title: item.title, date, ...(item.time ? { time: item.time, minutes: 30 } : {}), ...(item.notes ? { notes: item.notes } : {}), done: false });
    } else if (item.kind === 'assignment') {
      if (!isValidDateKey(item.due)) { reject(item.id, `bad due date ${item.due}`); continue; }
      if (college.assignments.some((a) => a.id === id)) continue;
      const subject = matchSubject(college.subjects, item.subject);
      const notes = [item.notes, item.subject && !subject ? `Subject: ${item.subject}` : undefined].filter(Boolean).join('\n');
      college = { ...college, assignments: [...college.assignments, { id, title: item.title, due: item.due, done: false, ...(subject ? { subjectId: subject.id } : {}), ...(notes ? { notes } : {}) }] };
    } else if (item.kind === 'exam') {
      if (!isValidDateKey(item.date)) { reject(item.id, `bad date ${item.date}`); continue; }
      if ((item.start && !HHMM.test(item.start)) || (item.end && !HHMM.test(item.end))) { reject(item.id, 'bad time'); continue; }
      if (college.exams.some((e) => e.id === id)) continue;
      const subject = matchSubject(college.subjects, item.subject);
      const title = item.title ?? (subject ? undefined : item.subject);
      college = {
        ...college,
        exams: [
          ...college.exams,
          {
            id,
            series: item.series,
            date: item.date,
            ...(subject ? { subjectId: subject.id } : {}),
            ...(title ? { title } : {}),
            ...(item.start ? { start: item.start } : {}),
            ...(item.end ? { end: item.end } : {}),
            ...(item.room ? { room: item.room } : {}),
            ...(item.syllabus ? { syllabus: item.syllabus } : {}),
          },
        ],
      };
    } else {
      if (projects.ideas.some((i) => i.id === id)) continue;
      projects = addIdea(projects, item.text, today, id);
    }
    added.push(item.id);
  }
  return { college, habits, projects, handled, added, rejected };
}
