import type { AgendaEvent } from './agenda';
import { resolveDay, subjectName, type CollegeState } from './college';
import { addDays, atTime, fromDateKey } from './dates';
import { habitsForDay, isCompleted } from './habits';
import { parseReminderTime } from './reminders';
import { sessionStatus, slotsOn, type Course } from './courses';
import { blockOccurrences } from './schedule';
import type { DateKey, HabitState, ScheduleBlock } from './types';

interface Base {
  /** Unique within a day's timeline. */
  key: string;
  title: string;
  start: Date;
}

export type TimelineItem =
  | (Base & { kind: 'event'; end: Date; location?: string; conflict: boolean })
  | (Base & { kind: 'block'; blockId: string; end: Date; conflict: boolean })
  | (Base & { kind: 'habit'; habitId: string; done: boolean })
  | (Base & {
      kind: 'class';
      /** `ClassOccurrence.key`, for opening the class editor. */
      occurrenceKey: string;
      /** Subject short name (e.g. "DSA"), used when the full title doesn't fit. */
      short?: string;
      slotId?: string;
      changeId?: string;
      end: Date;
      room: string;
      color?: string;
      changed: boolean;
      conflict: boolean;
    })
  | (Base & { kind: 'exam'; examId: string; series: string; end: Date; room?: string; conflict: boolean })
  | (Base & { kind: 'study'; studyId: string; end: Date; done: boolean; conflict: boolean })
  | (Base & { kind: 'task'; taskId: string; end: Date; done: boolean; conflict: boolean })
  /** A weekly study slot of a self-paced course; `done` = session marked done. */
  | (Base & { kind: 'course'; courseId: string; slotId: string; end: Date; done: boolean; color: string; conflict: boolean });

export interface DayTimeline {
  /** All-day events (and timed events covering the whole day). */
  allDay: AgendaEvent[];
  /** Timed items sorted by start. */
  items: TimelineItem[];
}

interface Sources {
  events?: readonly AgendaEvent[];
  blocks?: readonly ScheduleBlock[];
  /** When given, active habits with a reminder time appear as timeline points. */
  habitState?: HabitState;
  /** When given, the day's (non-cancelled) classes and timed exams are included; untimed exams go to all-day. */
  college?: CollegeState;
  /** When given, active courses' study slots are included. */
  courses?: readonly Course[];
}

/** Length used to draw a timed task that has no duration. */
export const DEFAULT_TASK_MINUTES = 30;

const KIND_ORDER = { exam: 0, class: 1, block: 2, event: 3, study: 4, course: 4, task: 5, habit: 6 } as const;

export function buildTimeline(day: DateKey, { events = [], blocks = [], habitState, college, courses = [] }: Sources): DayTimeline {
  const dayStart = fromDateKey(day);
  const dayEnd = fromDateKey(addDays(day, 1));
  const allDay: AgendaEvent[] = [];
  const items: TimelineItem[] = [];

  for (const e of events) {
    const touches = e.end > e.start ? e.start < dayEnd && e.end > dayStart : e.start >= dayStart && e.start < dayEnd;
    if (!touches) continue;
    if (e.allDay || (e.start <= dayStart && e.end >= dayEnd)) allDay.push(e);
    else items.push({ kind: 'event', key: `e:${e.id}:${e.start.getTime()}`, title: e.title, start: e.start, end: e.end, location: e.location, conflict: false });
  }

  for (const c of courses) {
    for (const slot of slotsOn(c, day)) {
      items.push({ kind: 'course', key: `co:${c.id}:${slot.id}`, courseId: c.id, slotId: slot.id, title: c.title, start: atTime(day, slot.start), end: atTime(day, slot.end), done: sessionStatus(c, day, slot.id) === 'done', color: c.color, conflict: false });
    }
  }

  for (const o of blockOccurrences(blocks, day)) {
    items.push({ kind: 'block', key: `b:${o.block.id}:${o.start.getTime()}`, blockId: o.block.id, title: o.block.title, start: o.start, end: o.end, conflict: false });
  }

  if (habitState) {
    for (const h of habitsForDay(habitState, day)) {
      const t = h.reminderTime ? parseReminderTime(h.reminderTime) : null;
      if (!t) continue;
      const start = new Date(dayStart);
      start.setHours(t.hour, t.minute, 0, 0);
      items.push({ kind: 'habit', key: `h:${h.id}`, habitId: h.id, title: h.name, start, done: isCompleted(habitState, h.id, day) });
    }
    for (const t of habitState.todos ?? []) {
      if (t.date !== day || !t.time) continue;
      const start = atTime(day, t.time);
      const end = new Date(start.getTime() + (t.minutes ?? DEFAULT_TASK_MINUTES) * 60_000);
      items.push({ kind: 'task', key: `t:${t.id}`, taskId: t.id, title: t.title, start, end, done: t.done, conflict: false });
    }
  }

  if (college) {
    for (const o of resolveDay(college, day)) {
      if (o.status === 'cancelled') continue;
      items.push({
        kind: 'class',
        key: `c:${o.key}`,
        occurrenceKey: o.key,
        // Prefer the subject's short name when the class is just the subject (not a custom title).
        short: o.subject && o.title === o.subject.name ? o.subject.short : undefined,
        slotId: o.slotId,
        changeId: o.changeId,
        title: o.title,
        start: o.start,
        end: o.end,
        room: o.room,
        color: o.subject?.color,
        changed: o.status !== 'regular',
        conflict: false,
      });
    }
    for (const exam of college.exams.filter((e) => e.date === day)) {
      const title = `${exam.series}: ${subjectName(college, exam.subjectId, exam.title)}`;
      if (exam.start && exam.end) {
        items.push({ kind: 'exam', key: `x:${exam.id}`, examId: exam.id, series: exam.series, title, start: atTime(day, exam.start), end: atTime(day, exam.end), room: exam.room, conflict: false });
      } else {
        allDay.push({ id: `exam:${exam.id}`, calendarId: 'college', title: `${title} (time TBA)`, start: dayStart, end: dayEnd, allDay: true });
      }
    }
    for (const s of college.study.filter((x) => x.date === day)) {
      items.push({ kind: 'study', key: `st:${s.id}`, studyId: s.id, title: s.title, start: atTime(day, s.start), end: atTime(day, s.end), done: s.done, conflict: false });
    }
    for (const a of college.assignments.filter((x) => x.due === day && !x.done)) {
      allDay.push({ id: `assignment:${a.id}`, calendarId: 'college', title: `Due: ${a.title}`, start: dayStart, end: dayEnd, allDay: true });
    }
  }

  // Flag overlaps between items with a duration (habits are points in time). Exams replace classes
  // on exam days, so class-vs-exam overlaps are expected and not flagged.
  const spans = items.filter((i): i is Exclude<TimelineItem, { kind: 'habit' }> => i.kind !== 'habit');
  const expected = (x: TimelineItem, y: TimelineItem) =>
    (x.kind === 'class' && y.kind === 'exam') || (x.kind === 'exam' && y.kind === 'class');
  for (let a = 0; a < spans.length; a++) {
    for (let b = a + 1; b < spans.length; b++) {
      if (expected(spans[a], spans[b])) continue;
      if (spans[a].start < spans[b].end && spans[b].start < spans[a].end) {
        spans[a].conflict = true;
        spans[b].conflict = true;
      }
    }
  }

  items.sort((x, y) => x.start.getTime() - y.start.getTime() || KIND_ORDER[x.kind] - KIND_ORDER[y.kind]);
  return { allDay, items };
}
