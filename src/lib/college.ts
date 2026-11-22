import { addDays, atTime, daysBetween, isValidDateKey, weekdayOf } from './dates';
import { sanitizeLinks, type ResourceLink } from './links';
import { parseReminderTime } from './reminders';
import type { DateKey, Weekday } from './types';

export interface Subject {
  id: string;
  name: string;
  /** Short label for compact UI, e.g. "DSA". */
  short: string;
  code?: string;
  /** Hex colour used for bars/dots. */
  color: string;
  /** Drive folders, notes, Classroom, GitHub... opened from the subject, its classes and exams. */
  links?: ResourceLink[];
}

/** A recurring weekly class. */
export interface TimetableSlot {
  id: string;
  day: Weekday;
  start: string;
  end: string;
  subjectId?: string;
  /** Overrides the subject name (e.g. "OOPS Tutorial"), or names a non-subject slot ("Proctoring"). */
  title?: string;
  room?: string;
  note?: string;
}

/**
 * A one-off change to a specific date.
 * - `cancel`: the regular slot doesn't happen that day.
 * - `edit`: the regular slot happens with different time/room/title that day.
 * - `extra`: an additional class that day (also how "move to another day" lands).
 */
export type ClassChange =
  | { id: string; kind: 'cancel'; date: DateKey; slotId: string }
  | { id: string; kind: 'edit'; date: DateKey; slotId: string; start: string; end: string; room?: string; title?: string }
  | { id: string; kind: 'extra'; date: DateKey; start: string; end: string; subjectId?: string; title?: string; room?: string; note?: string };

export interface Topic {
  id: string;
  title: string;
  done: boolean;
}

export interface Exam {
  id: string;
  /** Series name, e.g. "IA1". */
  series: string;
  subjectId?: string;
  title?: string;
  date: DateKey;
  start?: string;
  end?: string;
  room?: string;
  syllabus?: string;
  /** Revision checklist. */
  topics?: Topic[];
}

export type AttendanceStatus = 'present' | 'absent';

/** Attendance for one class occurrence (`key` is `ClassOccurrence.key`). */
export interface AttendanceMark {
  date: DateKey;
  key: string;
  /** Captured at marking time so stats survive timetable edits. */
  subjectId?: string;
  status: AttendanceStatus;
}

export interface Assignment {
  id: string;
  subjectId?: string;
  title: string;
  due: DateKey;
  done: boolean;
  notes?: string;
}

/** One internal-assessment component (IA1, lab record...) for a subject. */
export interface MarkEntry {
  id: string;
  subjectId: string;
  label: string;
  scored: number;
  outOf: number;
}

export interface GradeConfig {
  /** Share of the final grade from internals, in %. */
  internalWeight: number;
  /** Maximum marks of the semester-end exam. */
  finalMax: number;
  /** Target overall %, e.g. 60 for first class. */
  target: number;
}

/** A planned revision session (created by the study planner or by hand). */
export interface StudySession {
  id: string;
  examId?: string;
  title: string;
  date: DateKey;
  start: string;
  end: string;
  done: boolean;
}

/** Club events, workshops etc. that can clash with exams. Inclusive date range. */
export interface CollegeEvent {
  id: string;
  title: string;
  startDate: DateKey;
  endDate: DateKey;
  note?: string;
}

/** A recall card for revision (Leitner boxes 1–5). */
export interface Flashcard {
  id: string;
  subjectId?: string;
  examId?: string;
  /** Syllabus topic it was made from. */
  topicId?: string;
  front: string;
  back: string;
  box: number;
  /** Next review day. */
  due: DateKey;
  reviewedAt?: number;
}

/** Official attendance for a subject up to `asOf` (e.g. from the college portal). Marks after it add on top. */
export interface AttendanceBaseline {
  present: number;
  total: number;
  asOf: DateKey;
  /** Classes left in the semester, as of `asOf`. */
  remaining?: number;
  faculty?: string;
  absences?: { date: DateKey; time: string }[];
}

export interface CollegeState {
  version: 1;
  /** e.g. "B.Tech CSE · Sem 3 · Section A" */
  profile: string;
  defaultRoom: string;
  subjects: Subject[];
  slots: TimetableSlot[];
  changes: ClassChange[];
  exams: Exam[];
  events: CollegeEvent[];
  attendance: AttendanceMark[];
  /** Minimum attendance %, e.g. 75. */
  attendanceTarget: number;
  assignments: Assignment[];
  marks: MarkEntry[];
  grade: GradeConfig;
  study: StudySession[];
  /** Flashcards (added later; absent in older data). */
  cards?: Flashcard[];
  /** Portal attendance per subject id (added later). */
  attendanceBaseline?: Record<string, AttendanceBaseline>;
  /** Latest portal snapshot date applied (so a bundled snapshot is applied once). */
  attendanceSyncedAt?: DateKey;
  /** The semester the fields above belong to (added later; absent = one unnamed semester). */
  semester?: SemesterInfo;
  /** Earlier (or other) semesters, each with its own copy of the per-semester fields. */
  pastSemesters?: StoredSemester[];
}

export interface SemesterInfo {
  id: string;
  /** e.g. "Semester 4" */
  name: string;
  /** Classes only happen from `start` to `end` (inclusive) when set. */
  start?: DateKey;
  end?: DateKey;
}

/** Everything that belongs to one semester. Habits, tasks and projects are not per-semester. */
export const SEMESTER_FIELDS = ['subjects', 'slots', 'changes', 'exams', 'events', 'attendance', 'assignments', 'marks', 'study', 'cards', 'attendanceBaseline', 'attendanceSyncedAt'] as const;
export type SemesterData = Pick<CollegeState, (typeof SEMESTER_FIELDS)[number]>;
export interface StoredSemester extends SemesterInfo {
  data: SemesterData;
}

/** Whether `date` falls inside the current semester's dates (always true when no dates are set). */
export function inSemester(state: Pick<CollegeState, 'semester'>, date: DateKey): boolean {
  const s = state.semester;
  return !s || ((!s.start || date >= s.start) && (!s.end || date <= s.end));
}

export const emptyCollege = (): CollegeState => ({
  version: 1,
  profile: '',
  defaultRoom: '',
  subjects: [],
  slots: [],
  changes: [],
  exams: [],
  events: [],
  attendance: [],
  attendanceTarget: 75,
  assignments: [],
  marks: [],
  grade: { internalWeight: 50, finalMax: 100, target: 60 },
  study: [],
});

/** Previous default subject colours → their replacements in the current palette (applied on load). */
const LEGACY_SUBJECT_COLORS: Record<string, string> = {
  '#4F46E5': '#3A3A3A',
  '#6E56CF': '#3A3A3A',
  '#0D9488': '#187A63',
  '#D97706': '#D9822B',
  '#DB2777': '#C2417A',
  '#2563EB': '#376FBE',
  '#7C3AED': '#8E6C3A',
  '#059669': '#2E9BB5',
  '#DC2626': '#B54A3C',
  '#64748B': '#5E6577',
};

/** Swaps an old default colour for its current-palette equivalent; custom colours are left alone. */
export const refreshSubjectColor = (c: string) => LEGACY_SUBJECT_COLORS[c.toUpperCase()] ?? c;

/** Curated subject palette: distinct at a glance, calm together, readable with white or ink text. */
export const SUBJECT_COLORS = ['#3A3A3A', '#187A63', '#D9822B', '#C2417A', '#376FBE', '#8E6C3A', '#2E9BB5', '#B54A3C', '#5E6577'];

// ---------- validation ----------

const minutes = (hhmm: string) => {
  const t = parseReminderTime(hhmm);
  return t ? t.hour * 60 + t.minute : null;
};

/** Same-day time range check (classes don't run past midnight). */
export function validateTimeRange(start: string, end: string): string | null {
  const s = minutes(start);
  const e = minutes(end);
  if (s === null || e === null) return 'Use 24h times, e.g. 08:30';
  if (e <= s) return 'End must be after start';
  return null;
}

export function validateSlot(slot: Omit<TimetableSlot, 'id'>): string | null {
  if (!slot.subjectId && !slot.title?.trim()) return 'Pick a subject or enter a title';
  return validateTimeRange(slot.start, slot.end);
}

// ---------- resolving a day ----------

export interface ClassOccurrence {
  /** Stable key for lists. */
  key: string;
  date: DateKey;
  slotId?: string;
  changeId?: string;
  subject?: Subject;
  title: string;
  start: Date;
  end: Date;
  startText: string;
  endText: string;
  room: string;
  note?: string;
  status: 'regular' | 'changed' | 'extra' | 'cancelled';
}

export function subjectName(state: CollegeState, subjectId?: string, title?: string): string {
  if (title?.trim()) return title.trim();
  return state.subjects.find((s) => s.id === subjectId)?.name ?? 'Class';
}

/** All classes on `date` after applying one-off changes, sorted by start. Cancelled ones are included and marked. */
export function resolveDay(state: CollegeState, date: DateKey): ClassOccurrence[] {
  // Outside the semester's dates there are no classes (holidays between semesters, before it starts...).
  if (!inSemester(state, date)) return [];
  const weekday = weekdayOf(date);
  const changes = state.changes.filter((c) => c.date === date);
  const subjectOf = (id?: string) => state.subjects.find((s) => s.id === id);
  const out: ClassOccurrence[] = [];

  for (const slot of state.slots.filter((s) => s.day === weekday)) {
    const cancel = changes.find((c) => c.kind === 'cancel' && c.slotId === slot.id);
    const edit = changes.find((c): c is Extract<ClassChange, { kind: 'edit' }> => c.kind === 'edit' && c.slotId === slot.id);
    const start = edit?.start ?? slot.start;
    const end = edit?.end ?? slot.end;
    out.push({
      key: `s:${slot.id}`,
      date,
      slotId: slot.id,
      changeId: cancel?.id ?? edit?.id,
      subject: subjectOf(slot.subjectId),
      title: subjectName(state, slot.subjectId, edit?.title ?? slot.title),
      start: atTime(date, start),
      end: atTime(date, end),
      startText: start,
      endText: end,
      room: edit?.room || slot.room || state.defaultRoom,
      note: slot.note,
      status: cancel ? 'cancelled' : edit ? 'changed' : 'regular',
    });
  }

  for (const c of changes) {
    if (c.kind !== 'extra') continue;
    out.push({
      key: `x:${c.id}`,
      date,
      changeId: c.id,
      subject: subjectOf(c.subjectId),
      title: subjectName(state, c.subjectId, c.title),
      start: atTime(date, c.start),
      end: atTime(date, c.end),
      startText: c.start,
      endText: c.end,
      room: c.room || state.defaultRoom,
      note: c.note,
      status: 'extra',
    });
  }

  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

// ---------- mutations (pure) ----------

const withoutChangesFor = (changes: ClassChange[], date: DateKey, slotId: string) =>
  changes.filter((c) => !(c.date === date && c.kind !== 'extra' && c.slotId === slotId));

/** Cancel a regular class for one date (replaces any edit for that date). */
export function cancelOccurrence(state: CollegeState, date: DateKey, slotId: string, id: string): CollegeState {
  return { ...state, changes: [...withoutChangesFor(state.changes, date, slotId), { id, kind: 'cancel', date, slotId }] };
}

/** Change time/room/title of a regular class for one date only. */
export function editOccurrence(
  state: CollegeState,
  date: DateKey,
  slotId: string,
  patch: { start: string; end: string; room?: string; title?: string },
  id: string,
): CollegeState {
  const err = validateTimeRange(patch.start, patch.end);
  if (err) throw new Error(err);
  return {
    ...state,
    changes: [...withoutChangesFor(state.changes, date, slotId), { id, kind: 'edit', date, slotId, ...patch }],
  };
}

/** Undo any cancel/edit of a regular class on a date. */
export function restoreOccurrence(state: CollegeState, date: DateKey, slotId: string): CollegeState {
  return { ...state, changes: withoutChangesFor(state.changes, date, slotId) };
}

export function addExtraClass(state: CollegeState, extra: Omit<Extract<ClassChange, { kind: 'extra' }>, 'id' | 'kind'>, id: string): CollegeState {
  if (!isValidDateKey(extra.date)) throw new Error('Use a date like 2026-11-20');
  const err = validateTimeRange(extra.start, extra.end);
  if (err) throw new Error(err);
  if (!extra.subjectId && !extra.title?.trim()) throw new Error('Pick a subject or enter a title');
  return { ...state, changes: [...state.changes, { id, kind: 'extra', ...extra }] };
}

export function removeChange(state: CollegeState, changeId: string): CollegeState {
  return { ...state, changes: state.changes.filter((c) => c.id !== changeId) };
}

/**
 * Move one occurrence to another date/time: the original is cancelled (regular slot) or removed (extra),
 * and an extra class is added on the target date carrying the same subject/title/room.
 */
export function moveOccurrence(
  state: CollegeState,
  occ: ClassOccurrence,
  target: { date: DateKey; start: string; end: string },
  ids: { cancelId: string; extraId: string },
): CollegeState {
  const slot = occ.slotId ? state.slots.find((s) => s.id === occ.slotId) : undefined;
  const extraSource = !occ.slotId && occ.changeId ? state.changes.find((c) => c.id === occ.changeId) : undefined;
  const subjectId = slot?.subjectId ?? (extraSource?.kind === 'extra' ? extraSource.subjectId : undefined);
  const title = occ.subject && occ.title === occ.subject.name ? undefined : occ.title;

  let next = occ.slotId ? cancelOccurrence(state, occ.date, occ.slotId, ids.cancelId) : removeChange(state, occ.changeId!);
  next = addExtraClass(
    next,
    { date: target.date, start: target.start, end: target.end, subjectId, title, room: occ.room, note: `Moved from ${occ.date}` },
    ids.extraId,
  );
  return next;
}

// ---------- exams ----------

export interface ExamWithClashes {
  exam: Exam;
  title: string;
  daysAway: number;
  clashes: string[];
}

const overlaps = (a: Exam, b: Exam) => {
  if (a.date !== b.date) return false;
  if (!a.start || !a.end || !b.start || !b.end) return true; // same day, unknown times: flag to be safe
  return (minutes(a.start) ?? 0) < (minutes(b.end) ?? 0) && (minutes(b.start) ?? 0) < (minutes(a.end) ?? 0);
};

/** Upcoming (today or later) exams with countdown and clash notes, soonest first. */
export function upcomingExams(state: CollegeState, today: DateKey): ExamWithClashes[] {
  return state.exams
    .filter((e) => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? '').localeCompare(b.start ?? ''))
    .map((exam) => {
      const clashes: string[] = [];
      for (const ev of state.events) {
        if (exam.date >= ev.startDate && exam.date <= ev.endDate) clashes.push(ev.title);
      }
      for (const other of state.exams) {
        if (other.id !== exam.id && overlaps(exam, other)) clashes.push(subjectName(state, other.subjectId, other.title) + ' exam');
      }
      return { exam, title: subjectName(state, exam.subjectId, exam.title), daysAway: daysBetween(today, exam.date), clashes };
    });
}

export function countdownLabel(daysAway: number): string {
  if (daysAway === 0) return 'Today';
  if (daysAway === 1) return 'Tomorrow';
  return `In ${daysAway} days`;
}

/** The next date (from `from`, inclusive) that has any non-cancelled class, within two weeks. */
export function nextClassDay(state: CollegeState, from: DateKey): DateKey | null {
  for (let i = 0; i < 14; i++) {
    const d = addDays(from, i);
    if (resolveDay(state, d).some((o) => o.status !== 'cancelled')) return d;
  }
  return null;
}

// ---------- storage migration ----------

export function migrateCollege(value: unknown): CollegeState | null {
  const v = value as Partial<CollegeState> | null;
  if (!v || v.version !== 1) return null;
  const arrays = ['subjects', 'slots', 'changes', 'exams', 'events'] as const;
  if (!arrays.every((k) => Array.isArray(v[k]))) return null;
  // Fields added after the first release default when missing.
  const base = emptyCollege();
  return {
    ...base,
    ...v,
    version: 1,
    attendance: Array.isArray(v.attendance) ? v.attendance : [],
    assignments: Array.isArray(v.assignments) ? v.assignments : [],
    marks: Array.isArray(v.marks) ? v.marks : [],
    study: Array.isArray(v.study) ? v.study : [],
    ...(v.cards === undefined ? {} : { cards: Array.isArray(v.cards) ? v.cards : [] }),
    ...(v.attendanceBaseline && typeof v.attendanceBaseline === 'object' ? { attendanceBaseline: v.attendanceBaseline } : {}),
    ...(typeof v.attendanceSyncedAt === 'string' ? { attendanceSyncedAt: v.attendanceSyncedAt } : {}),
    semester: sanitizeSemesterInfo(v.semester),
    pastSemesters: Array.isArray(v.pastSemesters) ? v.pastSemesters.flatMap((p) => sanitizeStored(p)) : undefined,
    attendanceTarget: typeof v.attendanceTarget === 'number' ? v.attendanceTarget : base.attendanceTarget,
    grade: { ...base.grade, ...(v.grade ?? {}) },
    subjects: v.subjects!.map((sub) => {
      const color = typeof sub.color === 'string' ? refreshSubjectColor(sub.color) : sub.color;
      return sub.links === undefined ? { ...sub, color } : { ...sub, color, links: sanitizeLinks(sub.links) };
    }),
  } as CollegeState;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function sanitizeSemesterInfo(v: unknown): SemesterInfo | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const s = v as Partial<SemesterInfo>;
  if (typeof s.id !== 'string' || typeof s.name !== 'string') return undefined;
  return {
    id: s.id,
    name: s.name,
    ...(typeof s.start === 'string' && DATE_RE.test(s.start) ? { start: s.start } : {}),
    ...(typeof s.end === 'string' && DATE_RE.test(s.end) ? { end: s.end } : {}),
  };
}

/** A stored semester's data goes through the same migration as the live data. */
function sanitizeStored(v: unknown): StoredSemester[] {
  const info = sanitizeSemesterInfo(v);
  const raw = (v as { data?: unknown } | null)?.data;
  if (!info || !raw || typeof raw !== 'object') return [];
  const migrated = migrateCollege({ ...emptyCollege(), ...(raw as object), version: 1 });
  if (!migrated) return [];
  const data = {} as Record<string, unknown>;
  for (const k of SEMESTER_FIELDS) if (migrated[k] !== undefined) data[k] = migrated[k];
  return [{ ...info, data: data as unknown as SemesterData }];
}

export function setSubjectLinks(state: CollegeState, subjectId: string, links: ResourceLink[]): CollegeState {
  return { ...state, subjects: state.subjects.map((s) => (s.id === subjectId ? { ...s, links } : s)) };
}

/** Keys of non-cancelled classes that overlap another non-cancelled class on the same day. */
export function overlappingClassKeys(occs: readonly ClassOccurrence[]): Set<string> {
  const live = occs.filter((o) => o.status !== 'cancelled');
  const keys = new Set<string>();
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      if (live[i].start < live[j].end && live[j].start < live[i].end) {
        keys.add(live[i].key);
        keys.add(live[j].key);
      }
    }
  }
  return keys;
}
