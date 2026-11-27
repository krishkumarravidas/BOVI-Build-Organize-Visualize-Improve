/**
 * Self-paced courses (Udemy, YouTube series, a book...), managed like college subjects: lessons in
 * sections, weekly study slots that show on the calendar, sessions marked done/skipped like
 * attendance, and a pace check against an optional finish date.
 */
import { addDays, atTime, daysBetween, fromDateKey, isValidDateKey, toDateKey, weekdayOf } from './dates';
import type { DateKey, Weekday } from './types';

export interface Lesson {
  id: string;
  title: string;
  minutes?: number;
  done: boolean;
  doneAt?: number;
}

export interface CourseSection {
  id: string;
  title: string;
  lessons: Lesson[];
}

/** A weekly study slot, like a timetable class. */
export interface CourseSlot {
  id: string;
  day: Weekday;
  start: string;
  end: string;
}

export interface CourseSession {
  date: DateKey;
  slotId: string;
  status: 'done' | 'skipped';
}

export type CourseStatus = 'active' | 'paused' | 'done';

export interface Course {
  id: string;
  title: string;
  /** Udemy, YouTube, a book... */
  provider?: string;
  url?: string;
  color: string;
  /** Project it's for (optional). */
  projectId?: string;
  status: CourseStatus;
  sections: CourseSection[];
  slots: CourseSlot[];
  sessions: CourseSession[];
  /** Planned finish date. */
  target?: DateKey;
  startedAt: DateKey;
  notes?: string;
}

// Charcoal last: it nearly disappears on the dark theme, so it shouldn't be the default.
export const COURSE_COLORS = ['#187A63', '#376FBE', '#D9822B', '#C2417A', '#2E9BB5', '#8E6C3A', '#B54A3C', '#3A3A3A'];
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const mins = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

export function newCourse(title: string, id: string, today: DateKey, color = COURSE_COLORS[0]): Course {
  return { id, title: title.trim(), color, status: 'active', sections: [], slots: [], sessions: [], startedAt: today };
}

export function validateCourse(c: Pick<Course, 'title' | 'target' | 'startedAt'>): string | null {
  if (!c.title.trim()) return 'Give the course a name';
  if (c.target && !isValidDateKey(c.target)) return 'Pick a finish date';
  if (c.target && c.target < c.startedAt) return 'The finish date is before the course started';
  return null;
}

export function validateSlot(s: Pick<CourseSlot, 'start' | 'end'>): string | null {
  if (!HHMM.test(s.start) || !HHMM.test(s.end)) return 'Pick a start and end time';
  if (mins(s.end) <= mins(s.start)) return 'The end time must be after the start';
  return null;
}

// ---------- curriculum paste ----------

/** Minutes from "(12:34)", "1:02:03", "12 min", "5m", "1h 5m", "1 hr 20 mins" at the end of a line. */
function trailingMinutes(line: string): { title: string; minutes?: number } {
  const patterns: [RegExp, (m: RegExpExecArray) => number][] = [
    [/[\s(\[·•|–—-]*(\d{1,2}):(\d{2}):(\d{2})[)\]]?\s*$/, (m) => Number(m[1]) * 60 + Number(m[2]) + (Number(m[3]) >= 30 ? 1 : 0)],
    [/[\s(\[·•|–—-]*(\d{1,3}):(\d{2})[)\]]?\s*$/, (m) => Number(m[1]) + (Number(m[2]) >= 30 ? 1 : 0)],
    [/[\s(\[·•|–—-]*(\d+)\s*h(?:rs?|ours?)?\s*(\d+)\s*m(?:in(?:ute)?s?)?[)\]]?\s*$/i, (m) => Number(m[1]) * 60 + Number(m[2])],
    [/[\s(\[·•|–—-]*(\d+)\s*h(?:rs?|ours?)?[)\]]?\s*$/i, (m) => Number(m[1]) * 60],
    [/[\s(\[·•|–—-]*(\d+)\s*m(?:in(?:ute)?s?)?[)\]]?\s*$/i, (m) => Number(m[1])],
  ];
  for (const [re, fn] of patterns) {
    const m = re.exec(line);
    if (m && m.index > 0) return { title: line.slice(0, m.index).trim(), minutes: Math.max(1, fn(m)) };
  }
  return { title: line.trim() };
}

const SECTION_RE = /^(?:#{1,6}\s+(.+)|(?:section|module|part|chapter|unit|week)\s*\d+\s*[:.\-–—]?\s*(.*)|(.+):)$/i;

/**
 * Turns a pasted curriculum into sections and lessons. Section lines: "# Title", "Section 2: Title",
 * "Module 3 - Title", or anything ending in ":". Other lines are lessons; numbering, bullets and
 * "Lecture 12" prefixes are dropped and a trailing duration becomes the lesson's minutes.
 */
export function parseCurriculum(text: string, newId: () => string): CourseSection[] {
  const out: CourseSection[] = [];
  let cur: CourseSection | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\t/g, ' ').trim();
    if (!line) continue;
    const sec = SECTION_RE.exec(line);
    if (sec) {
      const title = (sec[1] ?? sec[2] ?? sec[3] ?? '').trim() || line.replace(/[:.\-–—\s]+$/, '');
      cur = { id: newId(), title: trailingMinutes(title).title || title, lessons: [] };
      out.push(cur);
      continue;
    }
    const cleaned = line
      .replace(/^[-*•·▶►✓✔☐□]\s*/, '')
      .replace(/^(?:lecture|lesson|video|episode|ep\.?)\s*\d+\s*[:.\-–—]?\s*/i, '')
      .replace(/^\d+(?:\.\d+)*[.)]?\s+/, '');
    const { title, minutes } = trailingMinutes(cleaned);
    if (!title) continue;
    if (!cur) {
      cur = { id: newId(), title: 'Lessons', lessons: [] };
      out.push(cur);
    }
    cur.lessons.push({ id: newId(), title, ...(minutes ? { minutes } : {}), done: false });
  }
  return out.filter((s) => s.lessons.length > 0);
}

export function addSections(course: Course, sections: CourseSection[]): Course {
  return { ...course, sections: [...course.sections, ...sections] };
}

// ---------- lessons ----------

export function allLessons(course: Course): { section: CourseSection; lesson: Lesson }[] {
  return course.sections.flatMap((section) => section.lessons.map((lesson) => ({ section, lesson })));
}

export function toggleLesson(course: Course, lessonId: string, now: number): Course {
  return {
    ...course,
    sections: course.sections.map((s) => ({
      ...s,
      lessons: s.lessons.map((l) => (l.id === lessonId ? (l.done ? { ...l, done: false, doneAt: undefined } : { ...l, done: true, doneAt: now }) : l)),
    })),
  };
}

export function removeLesson(course: Course, lessonId: string): Course {
  return { ...course, sections: course.sections.map((s) => ({ ...s, lessons: s.lessons.filter((l) => l.id !== lessonId) })).filter((s) => s.lessons.length > 0) };
}

export function nextLesson(course: Course) {
  return allLessons(course).find((x) => !x.lesson.done) ?? null;
}

export function courseProgress(course: Course) {
  const ls = allLessons(course).map((x) => x.lesson);
  const done = ls.filter((l) => l.done);
  const minutesTotal = ls.reduce((a, l) => a + (l.minutes ?? 0), 0);
  const minutesDone = done.reduce((a, l) => a + (l.minutes ?? 0), 0);
  return { done: done.length, total: ls.length, percent: ls.length ? (done.length / ls.length) * 100 : 0, minutesDone, minutesTotal };
}

// ---------- schedule & sessions ----------

export function weeklyMinutes(course: Course): number {
  return course.slots.reduce((a, s) => a + Math.max(0, mins(s.end) - mins(s.start)), 0);
}

/** The course's study slots on `day` (only while active, and not before it started). */
export function slotsOn(course: Course, day: DateKey): CourseSlot[] {
  if (course.status !== 'active' || day < course.startedAt) return [];
  const wd = weekdayOf(day);
  return course.slots.filter((s) => s.day === wd).sort((a, b) => a.start.localeCompare(b.start));
}

export function sessionStatus(course: Course, date: DateKey, slotId: string): CourseSession['status'] | null {
  return course.sessions.find((s) => s.date === date && s.slotId === slotId)?.status ?? null;
}

export function markSession(course: Course, date: DateKey, slotId: string, status: CourseSession['status'] | null): Course {
  const rest = course.sessions.filter((s) => !(s.date === date && s.slotId === slotId));
  return { ...course, sessions: status ? [...rest, { date, slotId, status }] : rest };
}

/** Past study slots (last `days` days, plus today's that have started) with no done/skipped mark. */
export function unmarkedSessions(course: Course, now: Date, days = 14): { date: DateKey; slot: CourseSlot }[] {
  const today = toDateKey(now);
  const out: { date: DateKey; slot: CourseSlot }[] = [];
  for (let i = days; i >= 0; i--) {
    const date = addDays(today, -i);
    for (const slot of slotsOn(course, date)) {
      if (date === today && atTime(date, slot.start) > now) continue;
      if (!sessionStatus(course, date, slot.id)) out.push({ date, slot });
    }
  }
  return out;
}

/** Sessions kept: done vs skipped, % kept, and the current run of done sessions. */
export function consistency(course: Course) {
  const marked = [...course.sessions].sort((a, b) => (a.date + a.slotId).localeCompare(b.date + b.slotId));
  const done = marked.filter((s) => s.status === 'done').length;
  let streak = 0;
  for (let i = marked.length - 1; i >= 0 && marked[i].status === 'done'; i--) streak++;
  return { done, skipped: marked.length - done, percent: marked.length ? (done / marked.length) * 100 : null, streak };
}

// ---------- pace ----------

export interface Pace {
  remaining: number;
  /** Lessons per week needed to finish by the target (null without a target). */
  neededPerWeek: number | null;
  /** Lessons per week over the last 14 days. */
  recentPerWeek: number;
  /** When you'd finish at the recent rate (null if no recent progress). */
  projectedFinish: DateKey | null;
  /** On track for the target? null without a target or when finished. */
  onTrack: boolean | null;
  daysToTarget: number | null;
}

export function coursePace(course: Course, now: Date): Pace {
  const today = toDateKey(now);
  const ls = allLessons(course).map((x) => x.lesson);
  const remaining = ls.filter((l) => !l.done).length;
  const since = now.getTime() - 14 * 86_400_000;
  const recent = ls.filter((l) => l.done && (l.doneAt ?? 0) >= since).length;
  const recentPerWeek = Math.round((recent / 2) * 10) / 10;
  const daysToTarget = course.target ? daysBetween(today, course.target) : null;
  // Fractional weeks: rounding them up would understate the pace you need.
  const weeksLeft = daysToTarget !== null ? Math.max(1, (daysToTarget + 1) / 7) : null;
  const neededPerWeek = remaining === 0 || weeksLeft === null ? (remaining === 0 ? 0 : null) : Math.ceil(remaining / weeksLeft);
  const projectedFinish = remaining === 0 ? today : recentPerWeek > 0 ? addDays(today, Math.ceil((remaining / recentPerWeek) * 7)) : null;
  const onTrack =
    remaining === 0 || !course.target ? null : daysToTarget! < 0 ? false : projectedFinish !== null ? projectedFinish <= course.target : false;
  return { remaining, neededPerWeek, recentPerWeek, projectedFinish, onTrack, daysToTarget };
}

/** Deep-ish clean-up for stored courses (old or hand-edited data). */
export function sanitizeCourses(value: unknown): Course[] {
  if (!Array.isArray(value)) return [];
  const arr = <T,>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);
  return value
    .filter((c): c is Course => !!c && typeof c === 'object' && typeof (c as Course).id === 'string' && typeof (c as Course).title === 'string')
    .map((c) => ({
      ...c,
      color: typeof c.color === 'string' ? c.color : COURSE_COLORS[0],
      status: c.status === 'paused' || c.status === 'done' ? c.status : 'active',
      startedAt: typeof c.startedAt === 'string' && isValidDateKey(c.startedAt) ? c.startedAt : toDateKey(fromDateKey('2026-01-01')),
      sections: arr<CourseSection>(c.sections).map((s) => ({ ...s, lessons: arr<Lesson>(s.lessons) })),
      slots: arr<CourseSlot>(c.slots),
      sessions: arr<CourseSession>(c.sessions),
    }));
}
