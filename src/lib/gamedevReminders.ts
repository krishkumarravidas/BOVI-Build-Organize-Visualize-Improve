import { atTime, daysBetween, toDateKey } from './dates';
import type { DatedReminder } from './examReminders';
import { jamReminders, launchItems, nextPlanReminder, thisWeek, weekTasks } from './gamedev';
import type { ProjectsState } from './projects';

const LAUNCH_REMINDER_TIME = '09:00';
/** Only schedule launch steps due within this many days (Android caps scheduled alarms). */
const LAUNCH_HORIZON_DAYS = 30;

/** One-shot reminders for projects: Sunday planning, jam milestones and Steam launch steps. */
export function gamedevReminders(state: ProjectsState, now: Date): DatedReminder[] {
  const out: DatedReminder[] = [];
  const today = toDateKey(now);
  const live = state.projects.filter((p) => p.status !== 'done' && p.status !== 'parked');

  if (live.length) {
    const at = nextPlanReminder(now);
    const nextWeek = thisWeek(toDateKey(new Date(at.getTime() + 86_400_000)));
    const planned = weekTasks(state, nextWeek).length;
    if (!planned) out.push({ id: 'gamedev:plan', title: 'Weekly review', body: 'See how your week went, then pick 3–5 project tasks for the next one.', date: at });
  }

  out.push(...jamReminders(state.jams, now));

  for (const p of live) {
    if (!p.launchDate) continue;
    for (const item of launchItems(p, today)) {
      if (item.done || !item.date) continue;
      const days = daysBetween(today, item.date);
      if (days < 0 || days > LAUNCH_HORIZON_DAYS) continue;
      const date = atTime(item.date, LAUNCH_REMINDER_TIME);
      if (date <= now) continue;
      out.push({ id: `launch:${p.id}:${item.key}`, title: `${p.name}: ${item.title}`, body: item.hint ?? 'Steam launch checklist step due today.', date });
    }
  }
  return out;
}
