import { resolveDay, type AttendanceMark, type AttendanceStatus, type ClassOccurrence, type CollegeState, type Exam, type MarkEntry } from './college';
import { addDays } from './dates';
import type { DateKey } from './types';

// ---------- attendance ----------

export function attendanceFor(state: CollegeState, date: DateKey, key: string): AttendanceStatus | undefined {
  return state.attendance.find((a) => a.date === date && a.key === key)?.status;
}

/** Set (or clear with `null`) attendance for one class occurrence. */
export function markAttendance(state: CollegeState, occ: ClassOccurrence, status: AttendanceStatus | null): CollegeState {
  const rest = state.attendance.filter((a) => !(a.date === occ.date && a.key === occ.key));
  if (!status) return { ...state, attendance: rest };
  const mark: AttendanceMark = { date: occ.date, key: occ.key, subjectId: occ.subject?.id, status };
  return { ...state, attendance: [...rest, mark] };
}

export interface AttendanceStats {
  present: number;
  total: number;
  /** 0–100, or null when nothing is marked. */
  percent: number | null;
  /** Classes you can miss and stay at/above target (0 if below). */
  canSkip: number;
  /** Consecutive classes you must attend to reach target (0 if already there). */
  mustAttend: number;
}

export function attendanceStats(present: number, total: number, target: number): AttendanceStats {
  const t = target / 100;
  const percent = total ? (present / total) * 100 : null;
  // Largest k with present / (total + k) >= t.
  const canSkip = total && present / total >= t ? Math.floor(present / t - total + 1e-9) : 0;
  // Smallest k with (present + k) / (total + k) >= t.
  const mustAttend = t >= 1 ? (present < total ? Infinity : 0) : Math.max(0, Math.ceil((t * total - present) / (1 - t) - 1e-9));
  return { present, total, percent, canSkip: Math.max(0, canSkip), mustAttend };
}

export interface SubjectAttendanceCount {
  present: number;
  total: number;
  /** Classes left this semester (portal figure minus classes marked since), if known. */
  remaining: number | null;
  /** Portal snapshot date the counts start from, if any. */
  asOf: string | null;
}

/** Present/total for a subject: the portal baseline (if any) plus your own marks after its date. */
export function subjectAttendance(state: CollegeState, subjectId: string): SubjectAttendanceCount {
  const base = state.attendanceBaseline?.[subjectId];
  const marks = state.attendance.filter((a) => a.subjectId === subjectId && (!base || a.date > base.asOf));
  const present = (base?.present ?? 0) + marks.filter((m) => m.status === 'present').length;
  const total = (base?.total ?? 0) + marks.length;
  const remaining = base?.remaining !== undefined ? Math.max(0, base.remaining - marks.length) : null;
  return { present, total, remaining, asOf: base?.asOf ?? null };
}

export interface SemesterOutlook {
  /** % at the end of the semester if you attend every remaining class. */
  bestFinal: number;
  /** Remaining classes you can still miss and finish at/above target (0 if none; null if unreachable). */
  canMissOfRemaining: number | null;
}

/** End-of-semester view from the classes still to come. */
export function semesterOutlook(present: number, total: number, remaining: number, target: number): SemesterOutlook {
  const finalTotal = total + remaining;
  const bestFinal = finalTotal ? ((present + remaining) / finalTotal) * 100 : 0;
  const slack = Math.floor(present + remaining - (target / 100) * finalTotal + 1e-9);
  return { bestFinal, canMissOfRemaining: slack < 0 ? null : Math.min(slack, remaining) };
}

/** Per-subject attendance (portal baseline + marks linked to a subject), plus overall. */
export function attendanceBySubject(state: CollegeState) {
  const bySubject = state.subjects.map((subject) => {
    const c = subjectAttendance(state, subject.id);
    return { subject, remaining: c.remaining, asOf: c.asOf, ...attendanceStats(c.present, c.total, state.attendanceTarget) };
  });
  const present = bySubject.reduce((a, s) => a + s.present, 0);
  const total = bySubject.reduce((a, s) => a + s.total, 0);
  return { bySubject, overall: attendanceStats(present, total, state.attendanceTarget) };
}

/** Past classes (within `days` before today, plus today's started ones) that have no attendance mark. */
export function unmarkedClasses(state: CollegeState, today: DateKey, now: Date, days = 7): ClassOccurrence[] {
  const out: ClassOccurrence[] = [];
  for (let i = days; i >= 0; i--) {
    const d = addDays(today, -i);
    for (const o of resolveDay(state, d)) {
      if (o.status === 'cancelled' || !o.subject) continue;
      if (o.start.getTime() > now.getTime()) continue;
      // Already covered by the portal figures.
      const base = state.attendanceBaseline?.[o.subject.id];
      if (base && d <= base.asOf) continue;
      if (!attendanceFor(state, d, o.key)) out.push(o);
    }
  }
  return out;
}

// ---------- syllabus topics ----------

export function topicProgress(exam: Exam): { done: number; total: number } {
  const topics = exam.topics ?? [];
  return { done: topics.filter((t) => t.done).length, total: topics.length };
}

// ---------- marks & grade ----------

export interface SubjectMarks {
  scored: number;
  outOf: number;
  /** Internal %, or null with no entries. */
  percent: number | null;
  /** Marks needed in the final (out of finalMax) to hit the target, null if unknown; may exceed finalMax. */
  neededInFinal: number | null;
}

export function subjectMarks(entries: readonly MarkEntry[], grade: CollegeState['grade']): SubjectMarks {
  const scored = entries.reduce((a, e) => a + e.scored, 0);
  const outOf = entries.reduce((a, e) => a + e.outOf, 0);
  if (!outOf) return { scored, outOf, percent: null, neededInFinal: null };
  const internalPct = (scored / outOf) * 100;
  const w = grade.internalWeight / 100;
  if (w >= 1) return { scored, outOf, percent: internalPct, neededInFinal: 0 };
  const finalPct = (grade.target - internalPct * w) / (1 - w);
  return {
    scored,
    outOf,
    percent: internalPct,
    neededInFinal: Math.max(0, Math.ceil((finalPct / 100) * grade.finalMax - 1e-9)),
  };
}

export function validateMark(e: Pick<MarkEntry, 'label' | 'scored' | 'outOf'>): string | null {
  if (!e.label.trim()) return 'Enter a label, e.g. IA1';
  if (!Number.isFinite(e.outOf) || e.outOf <= 0) return 'Out of must be more than 0';
  if (!Number.isFinite(e.scored) || e.scored < 0 || e.scored > e.outOf) return 'Score must be between 0 and the maximum';
  return null;
}

// ---------- assignments ----------

export function dueAssignments(state: CollegeState, today: DateKey, withinDays = 14) {
  const last = addDays(today, withinDays);
  return state.assignments
    .filter((a) => !a.done && a.due <= last)
    .sort((a, b) => a.due.localeCompare(b.due))
    .map((a) => ({ assignment: a, overdue: a.due < today }));
}
