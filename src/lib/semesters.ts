/**
 * Semesters: the live college data is always the current semester (so every screen keeps working);
 * other semesters are stored whole and swapped in when you switch.
 */
import { attendanceBySubject } from './collegeStats';
import { SEMESTER_FIELDS, emptyCollege, type CollegeState, type SemesterData, type SemesterInfo, type StoredSemester } from './college';
import { daysBetween, isValidDateKey } from './dates';
import type { DateKey } from './types';

export const DEFAULT_SEMESTER_NAME = 'This semester';

/** The current semester's info (a default one when none was ever set). */
export function currentSemester(state: CollegeState): SemesterInfo {
  return state.semester ?? { id: 'sem-initial', name: DEFAULT_SEMESTER_NAME };
}

export function validateSemester(info: { name: string; start?: string; end?: string }): string | null {
  if (!info.name.trim()) return 'Give the semester a name, e.g. Semester 4';
  if (info.start && !isValidDateKey(info.start)) return 'Pick a start date';
  if (info.end && !isValidDateKey(info.end)) return 'Pick an end date';
  if (info.start && info.end && info.end < info.start) return 'The semester ends before it starts';
  return null;
}

export function updateSemesterInfo(state: CollegeState, patch: Partial<Omit<SemesterInfo, 'id'>>): CollegeState {
  const cur = currentSemester(state);
  const next: SemesterInfo = { ...cur, ...patch, name: (patch.name ?? cur.name).trim() };
  if (!next.start) delete next.start;
  if (!next.end) delete next.end;
  return { ...state, semester: next };
}

function extract(state: CollegeState): SemesterData {
  const data = {} as Record<string, unknown>;
  for (const k of SEMESTER_FIELDS) if (state[k] !== undefined) data[k] = state[k];
  return data as unknown as SemesterData;
}

/** Clears every per-semester field, then applies `data`. */
function load(state: CollegeState, data: Partial<SemesterData>): CollegeState {
  const base = emptyCollege();
  const cleared = { ...state } as Record<string, unknown>;
  for (const k of SEMESTER_FIELDS) cleared[k] = (base as unknown as Record<string, unknown>)[k];
  return { ...(cleared as unknown as CollegeState), ...data };
}

export interface NewSemesterInput {
  name: string;
  start?: DateKey;
  end?: DateKey;
  /** Carry the subject list over (same subjects, fresh attendance). */
  keepSubjects: boolean;
  /** Carry the weekly timetable over too (needs keepSubjects). */
  keepTimetable: boolean;
}

/** Stores the current semester and starts an empty one (optionally with the same subjects/timetable). */
export function startNewSemester(state: CollegeState, input: NewSemesterInput, id: string): CollegeState {
  const archived: StoredSemester = { ...currentSemester(state), data: extract(state) };
  const carry: Partial<SemesterData> = {};
  if (input.keepSubjects) carry.subjects = state.subjects.map((s) => ({ ...s }));
  if (input.keepSubjects && input.keepTimetable) carry.slots = state.slots.map((s) => ({ ...s }));
  const next = load(state, carry);
  return {
    ...next,
    semester: { id, name: input.name.trim(), ...(input.start ? { start: input.start } : {}), ...(input.end ? { end: input.end } : {}) },
    pastSemesters: [archived, ...(state.pastSemesters ?? [])],
  };
}

/** Makes a stored semester the current one; the current one is stored in its place. */
export function switchSemester(state: CollegeState, id: string): CollegeState {
  const target = (state.pastSemesters ?? []).find((p) => p.id === id);
  if (!target) return state;
  const archived: StoredSemester = { ...currentSemester(state), data: extract(state) };
  const rest = (state.pastSemesters ?? []).filter((p) => p.id !== id);
  const { data, ...info } = target;
  return { ...load(state, data), semester: info, pastSemesters: [archived, ...rest] };
}

export function deleteSemester(state: CollegeState, id: string): CollegeState {
  return { ...state, pastSemesters: (state.pastSemesters ?? []).filter((p) => p.id !== id) };
}

/** One-line numbers for a stored semester. */
export function semesterSummary(data: SemesterData, target: number) {
  const { overall } = attendanceBySubject({ ...emptyCollege(), ...data, attendanceTarget: target });
  return { subjects: data.subjects.length, exams: data.exams.length, attendance: overall.percent, classesMarked: overall.total };
}

/** Where today falls in the current semester, when it has dates. */
export function semesterProgress(info: SemesterInfo, today: DateKey): { week: number; weeks: number | null; daysLeft: number | null; status: 'before' | 'during' | 'after' } | null {
  if (!info.start) return null;
  if (today < info.start) return { week: 0, weeks: info.end ? Math.ceil((daysBetween(info.start, info.end) + 1) / 7) : null, daysLeft: info.end ? daysBetween(today, info.end) : null, status: 'before' };
  const week = Math.floor(daysBetween(info.start, today) / 7) + 1;
  const weeks = info.end ? Math.ceil((daysBetween(info.start, info.end) + 1) / 7) : null;
  if (info.end && today > info.end) return { week: weeks ?? week, weeks, daysLeft: 0, status: 'after' };
  return { week, weeks, daysLeft: info.end ? daysBetween(today, info.end) : null, status: 'during' };
}

/** Suggests the next name: "Semester 4" → "Semester 5", "Sem 3" → "Sem 4". */
export function nextSemesterName(name: string): string {
  const m = /^(.*?)(\d+)(\D*)$/.exec(name.trim());
  return m ? `${m[1]}${Number(m[2]) + 1}${m[3]}` : 'Next semester';
}
