import type { CollegeState } from './college';
import { addDays, fromDateKey, toDateKey } from './dates';
import { activityByDay, streak } from './gamedev';
import { habitsForDay, isCompleted } from './habits';
import type { ProjectsState } from './projects';
import type { DateKey, HabitState } from './types';

export interface PeriodSummary {
  from: DateKey;
  to: DateKey;
  habits: { done: number; total: number };
  attendance: { present: number; total: number };
  studyMin: number;
  gamedevMin: number;
  /** Tasks + features ticked. */
  tasksDone: number;
  milestonesDone: number;
  bugsFixed: number;
  builds: string[];
  playtests: number;
  devlogEntries: number;
  ideas: number;
  examsTaken: string[];
  gamedevDays: number;
  /** Streak as of the end of the period. */
  streak: number;
  topProject: { name: string; minutes: number } | null;
}

/** Everything that happened between `from` and `to` (inclusive day keys). */
export function summarize(from: DateKey, to: DateKey, sources: { college: CollegeState; habitState: HabitState; projects: ProjectsState }): PeriodSummary {
  const { college, habitState, projects } = sources;
  const fromMs = fromDateKey(from).getTime();
  const toMs = fromDateKey(addDays(to, 1)).getTime();
  const inMs = (t?: number) => !!t && t >= fromMs && t < toMs;
  const inDay = (d?: string) => !!d && d >= from && d <= to;

  let hDone = 0;
  let hTotal = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    for (const h of habitsForDay(habitState, d)) {
      hTotal++;
      if (isCompleted(habitState, h.id, d)) hDone++;
    }
  }

  const marks = college.attendance.filter((a) => a.subjectId && inDay(a.date));
  const sessions = projects.focus.filter((s) => inMs(s.start));
  const byProject = new Map<string, number>();
  for (const s of sessions) if (!s.subjectId && s.projectId) byProject.set(s.projectId, (byProject.get(s.projectId) ?? 0) + s.minutes);
  const top = [...byProject.entries()].sort((a, b) => b[1] - a[1])[0];

  let tasksDone = 0;
  let milestonesDone = 0;
  let devlogEntries = 0;
  for (const p of projects.projects) {
    tasksDone += p.tasks.filter((t) => t.done && inMs(t.doneAt)).length + (p.features ?? []).filter((f) => f.done && inMs(f.doneAt)).length;
    milestonesDone += p.milestones.filter((m) => m.done && inMs(m.doneAt)).length;
    devlogEntries += p.log.filter((e) => inDay(e.date)).length;
  }
  const activity = activityByDay(projects);
  let gamedevDays = 0;
  for (const d of activity.keys()) if (inDay(d)) gamedevDays++;

  return {
    from,
    to,
    habits: { done: hDone, total: hTotal },
    attendance: { present: marks.filter((m) => m.status === 'present').length, total: marks.length },
    studyMin: sessions.filter((s) => s.subjectId).reduce((a, s) => a + s.minutes, 0),
    gamedevMin: sessions.filter((s) => !s.subjectId).reduce((a, s) => a + s.minutes, 0),
    tasksDone,
    milestonesDone,
    bugsFixed: (projects.bugs ?? []).filter((b) => b.status === 'fixed' && inMs(b.fixedAt)).length,
    builds: (projects.builds ?? []).filter((b) => inDay(b.date)).map((b) => `${projects.projects.find((p) => p.id === b.projectId)?.name ?? ''} ${b.version}`.trim()),
    playtests: (projects.playtests ?? []).filter((t) => inDay(t.date)).length,
    devlogEntries,
    ideas: projects.ideas.filter((i) => inDay(i.createdAt)).length,
    examsTaken: college.exams.filter((e) => inDay(e.date)).map((e) => `${college.subjects.find((s) => s.id === e.subjectId)?.short ?? e.title ?? 'Exam'} ${e.series}`),
    gamedevDays,
    streak: streak(activity, to),
    topProject: top ? { name: projects.projects.find((p) => p.id === top[0])?.name ?? 'A project', minutes: top[1] } : null,
  };
}

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');
export const hours = (min: number) => (min >= 60 ? `${Math.round((min / 60) * 10) / 10} h` : `${min} min`);

/** Plain-text report for sharing (monthly report / weekly review). */
export function summaryText(label: string, s: PeriodSummary, projectsLabel = 'Projects'): string {
  const lines = [
    `BOVI · ${label}`,
    '',
    `${projectsLabel}: ${hours(s.gamedevMin)} focus on ${s.gamedevDays} day${s.gamedevDays === 1 ? '' : 's'}${s.topProject ? ` (most on ${s.topProject.name})` : ''}`,
    `Finished: ${s.tasksDone} tasks/features, ${s.milestonesDone} milestone${s.milestonesDone === 1 ? '' : 's'}, ${s.bugsFixed} bug${s.bugsFixed === 1 ? '' : 's'} fixed`,
  ];
  if (s.builds.length) lines.push(`Shipped: ${s.builds.join(', ')}`);
  if (s.playtests) lines.push(`Playtests: ${s.playtests}`);
  lines.push(`Study: ${hours(s.studyMin)}`, `Attendance: ${pct(s.attendance.present, s.attendance.total)}${s.attendance.total ? ` (${s.attendance.present}/${s.attendance.total})` : ''}`, `Habits: ${pct(s.habits.done, s.habits.total)}`);
  if (s.examsTaken.length) lines.push(`Exams: ${s.examsTaken.join(', ')}`);
  if (s.streak) lines.push(`Current streak: ${s.streak} day${s.streak === 1 ? '' : 's'}`);
  return lines.join('\n');
}

export function monthRange(month: string): { from: DateKey; to: DateKey } {
  const [y, m] = month.split('-').map(Number);
  return { from: toDateKey(new Date(y, m - 1, 1)), to: toDateKey(new Date(y, m, 0)) };
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}
