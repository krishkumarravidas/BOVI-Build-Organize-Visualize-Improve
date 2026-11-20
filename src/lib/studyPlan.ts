import type { AgendaEvent } from './agenda';
import { resolveDay, subjectName, type CollegeState, type Exam, type StudySession } from './college';
import { addDays, atTime, daysBetween, toDateKey, weekdayOf } from './dates';
import { blockOccurrences } from './schedule';
import type { DateKey, ScheduleBlock } from './types';

export interface PlanOptions {
  sessions: number;
  minutes: number;
  now: Date;
  /** Study windows (24h). Weekdays default to evenings, weekends to the day. */
  weekdayWindow?: [string, string];
  weekendWindow?: [string, string];
}

interface Busy {
  start: number;
  end: number;
}

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (ms: number) => {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const BUFFER_MS = 15 * 60_000;

/** Everything that already occupies time on `day`. */
function busyOn(day: DateKey, college: CollegeState, blocks: readonly ScheduleBlock[], events: readonly AgendaEvent[], extra: readonly StudySession[]): Busy[] {
  const out: Busy[] = [];
  for (const o of resolveDay(college, day)) if (o.status !== 'cancelled') out.push({ start: o.start.getTime(), end: o.end.getTime() });
  for (const o of blockOccurrences(blocks, day)) out.push({ start: o.start.getTime(), end: o.end.getTime() });
  for (const e of events) if (!e.allDay) out.push({ start: e.start.getTime(), end: e.end.getTime() });
  for (const x of college.exams) if (x.date === day && x.start && x.end) out.push({ start: atTime(day, x.start).getTime(), end: atTime(day, x.end).getTime() });
  for (const s of [...college.study, ...extra]) if (s.date === day) out.push({ start: atTime(day, s.start).getTime(), end: atTime(day, s.end).getTime() });
  return out;
}

/** Earliest free slot of `minutes` inside the day's window, starting on a :00/:30 boundary, after `notBefore`. */
function findSlot(day: DateKey, busy: Busy[], minutes: number, window: [string, string], notBefore: number): Busy | null {
  const winStart = atTime(day, window[0]).getTime();
  const winEnd = atTime(day, window[1]).getTime();
  const len = minutes * 60_000;
  const step = 30 * 60_000;
  let t = Math.max(winStart, Math.ceil(notBefore / step) * step);
  while (t + len <= winEnd) {
    const clash = busy.find((b) => t < b.end + BUFFER_MS && b.start - BUFFER_MS < t + len);
    if (!clash) return { start: t, end: t + len };
    t = Math.ceil((clash.end + BUFFER_MS) / step) * step;
  }
  return null;
}

/** Days to use: spread `n` picks evenly across `days`, always including the last (day before the exam). */
function spread<T>(days: T[], n: number): T[] {
  if (n >= days.length) return days;
  if (n === 1) return [days[days.length - 1]];
  return Array.from({ length: n }, (_, i) => days[Math.round((i * (days.length - 1)) / (n - 1))]);
}

/**
 * Proposes revision sessions before an exam, avoiding classes, schedule blocks, calendar events,
 * other exams and existing study sessions. Undone syllabus topics are assigned to sessions in order.
 * Returns fewer sessions than asked if there isn't room.
 */
export function planRevision(
  exam: Exam,
  college: CollegeState,
  blocks: readonly ScheduleBlock[],
  events: readonly AgendaEvent[],
  opts: PlanOptions,
  makeId: () => string,
): StudySession[] {
  const weekday = opts.weekdayWindow ?? ['17:30', '22:00'];
  const weekend = opts.weekendWindow ?? ['09:00', '21:00'];
  const today = toDateKey(opts.now);
  const lastDay = addDays(exam.date, -1);
  const span = daysBetween(today, lastDay);
  if (span < 0 || opts.sessions <= 0) return [];

  const allDays = Array.from({ length: span + 1 }, (_, i) => addDays(today, i));
  const windowFor = (d: DateKey): [string, string] => (weekdayOf(d) === 0 || weekdayOf(d) === 6 ? weekend : weekday);
  const name = subjectName(college, exam.subjectId, exam.title);
  const topics = (exam.topics ?? []).filter((t) => !t.done).map((t) => t.title);

  const planned: StudySession[] = [];
  const tryDay = (d: DateKey) => {
    const busy = busyOn(d, college, blocks, events.filter((e) => toDateKey(e.start) === d), planned);
    const slot = findSlot(d, busy, opts.minutes, windowFor(d), opts.now.getTime());
    if (!slot) return false;
    planned.push({ id: makeId(), examId: exam.id, title: '', date: d, start: hhmm(slot.start), end: hhmm(slot.end), done: false });
    return true;
  };

  // First pass: one session per chosen day; then fill remaining sessions into any day with room.
  for (const d of spread(allDays, opts.sessions)) if (planned.length < opts.sessions) tryDay(d);
  for (let guard = 0; planned.length < opts.sessions && guard < opts.sessions * allDays.length; guard++) {
    const progressed = allDays.some((d) => planned.length < opts.sessions && tryDay(d));
    if (!progressed) break;
  }

  return planned
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
    .map((s, i, all) => ({
      ...s,
      title: topics.length ? `Revise ${name}: ${topics[i % topics.length]}` : `Revise ${name} (${i + 1}/${all.length})`,
    }));
}
