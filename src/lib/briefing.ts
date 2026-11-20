import { resolveDay, upcomingExams, type CollegeState } from './college';
import { addDays, atTime, fromDateKey, toDateKey } from './dates';
import type { DatedReminder } from './examReminders';
import { gamedevDueOn, thisWeek, weekTasks } from './gamedev';
import { habitsForDay } from './habits';
import type { ProjectsState } from './projects';
import { openTasksOn } from './todos';
import type { DateKey, HabitState } from './types';

export interface BriefingSources {
  college: CollegeState;
  habitState: HabitState;
  projects: ProjectsState;
  /** The user's name for the projects tab ("Projects", "Game dev"…). */
  projectsLabel?: string;
}

const hm = (d: Date) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;

/** The morning summary for `day`: classes, exams soon, deadlines, habits and game-dev plan. */
export function buildBriefing(day: DateKey, { college, habitState, projects, projectsLabel = 'Projects' }: BriefingSources): { title: string; body: string } {
  const classes = resolveDay(college, day).filter((o) => o.status !== 'cancelled');
  const cancelled = resolveDay(college, day).filter((o) => o.status === 'cancelled').length;
  const changed = classes.filter((o) => o.status === 'changed' || o.status === 'extra').length;
  const lines: string[] = [];

  if (classes.length) {
    const list = classes.map((o) => `${o.subject && o.title === o.subject.name ? o.subject.short : o.title} ${hm(o.start)}`);
    lines.push(`Classes: ${list.slice(0, 6).join(', ')}${list.length > 6 ? ` +${list.length - 6}` : ''}`);
  }
  if (cancelled || changed) lines.push([cancelled ? `${cancelled} cancelled` : '', changed ? `${changed} changed` : ''].filter(Boolean).join(', '));

  for (const e of upcomingExams(college, day).filter((x) => x.daysAway <= 3).slice(0, 2)) {
    const when = e.daysAway === 0 ? `today${e.exam.start ? ` ${e.exam.start}` : ''}` : e.daysAway === 1 ? 'tomorrow' : `in ${e.daysAway} days`;
    lines.push(`Exam: ${e.title} ${when}`);
  }

  const due = college.assignments.filter((a) => !a.done && (a.due === day || a.due === addDays(day, 1)));
  if (due.length) lines.push(`Due: ${due.map((a) => `${a.title}${a.due === day ? ' (today)' : ' (tomorrow)'}`).join(', ')}`);

  // Undone untimed tasks from earlier days carry over to that morning too.
  const tasks = openTasksOn(habitState, day, day);
  if (tasks.length) {
    const names = tasks.map((t) => (t.time ? `${t.title} ${t.time.replace(/^0/, '')}` : t.title));
    lines.push(`Tasks: ${names.slice(0, 4).join(', ')}${names.length > 4 ? ` +${names.length - 4}` : ''}`);
  }

  const habits = habitsForDay(habitState, day).length;
  if (habits) lines.push(`${habits} habit${habits === 1 ? '' : 's'} today`);

  const planned = weekTasks(projects, thisWeek(day));
  const left = planned.filter((x) => !x.task.done).length;
  if (planned.length) lines.push(`${projectsLabel} this week: ${planned.length - left}/${planned.length} done`);
  for (const g of gamedevDueOn(projects, day).slice(0, 2)) lines.push(g.kind === 'jam' ? `Jam today: ${g.title}` : `${g.project}: ${g.title}`);

  const date = fromDateKey(day).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const title = classes.length ? `${date}: ${classes.length} class${classes.length === 1 ? '' : 'es'} from ${hm(classes[0].start)}` : `${date}: no classes`;
  return { title, body: lines.length ? lines.join('\n') : 'Nothing scheduled. A good day for your game.' };
}

/** Briefings for the next `days` days at `time` (re-planned each time the app syncs, so they stay fresh). */
export function planBriefings(now: Date, time: string | null, sources: BriefingSources, days = 7): DatedReminder[] {
  if (!time) return [];
  const out: DatedReminder[] = [];
  const today = toDateKey(now);
  for (let i = 0; i < days; i++) {
    const day = addDays(today, i);
    const date = atTime(day, time);
    if (date <= now) continue;
    const b = buildBriefing(day, sources);
    out.push({ id: `briefing:${day}`, title: b.title, body: b.body, date });
  }
  return out;
}
