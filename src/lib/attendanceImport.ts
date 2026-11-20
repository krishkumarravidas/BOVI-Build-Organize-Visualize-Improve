import { SUBJECT_COLORS, type AttendanceBaseline, type CollegeState, type Subject } from './college';
import { isValidDateKey } from './dates';
import type { DateKey } from './types';

/** One subject from the college attendance portal. */
export interface PortalSubject {
  code: string;
  name: string;
  faculty?: string;
  conducted: number;
  present: number;
  remaining?: number;
  absences: { date: DateKey; time: string }[];
}

export interface PortalSnapshot {
  /** Date the figures are valid for. */
  asOf: DateKey;
  source?: string;
  subjects: PortalSubject[];
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : null);

/**
 * Reads the portal export (the JSON with `subjects[].subject_code / classes_conducted / classes_present…`).
 * Returns an error message for anything that doesn't look like one.
 */
export function parsePortal(input: string | unknown): { ok: true; snapshot: PortalSnapshot } | { ok: false; error: string } {
  let raw: unknown = input;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input.trim());
    } catch {
      return { ok: false, error: 'That isn’t valid JSON. Paste the whole file, from { to }.' };
    }
  }
  const v = raw as { generated_on?: unknown; source?: unknown; subjects?: unknown } | null;
  if (!v || !Array.isArray(v.subjects)) return { ok: false, error: 'No "subjects" list found in that data.' };
  const asOf = typeof v.generated_on === 'string' && isValidDateKey(v.generated_on) ? v.generated_on : null;
  if (!asOf) return { ok: false, error: 'Missing "generated_on" date (YYYY-MM-DD).' };
  const subjects: PortalSubject[] = [];
  for (const s of v.subjects as Record<string, unknown>[]) {
    if (!s || typeof s !== 'object') continue;
    const conducted = num(s.classes_conducted);
    const present = num(s.classes_present);
    const code = typeof s.subject_code === 'string' ? s.subject_code.trim() : '';
    const name = typeof s.subject_name === 'string' ? s.subject_name.trim() : '';
    if (conducted === null || present === null || present > conducted || (!code && !name)) continue;
    const absences = Array.isArray(s.absent_records)
      ? (s.absent_records as Record<string, unknown>[])
          .filter((a) => a && typeof a.date === 'string' && isValidDateKey(a.date))
          .map((a) => ({ date: a.date as string, time: typeof a.time === 'string' ? a.time : '' }))
          .sort((a, b) => b.date.localeCompare(a.date))
      : [];
    subjects.push({
      code,
      name,
      faculty: typeof s.faculty === 'string' ? s.faculty : undefined,
      conducted,
      present,
      remaining: num(s.classes_remaining) ?? undefined,
      absences,
    });
  }
  if (!subjects.length) return { ok: false, error: 'No subjects with classes conducted/present were found.' };
  return { ok: true, snapshot: { asOf, source: typeof v.source === 'string' ? v.source : undefined, subjects } };
}

/** "CSL307A" and "CSL307X" are the same course family. */
const codeFamily = (code: string) => code.toUpperCase().replace(/[A-Z]+$/, '');

const words = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .replace(/&/g, ' and ')
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !['and', 'the', 'for', 'with', 'using', 'laboratory', 'lab'].includes(w)),
  );

function nameScore(a: string, b: string): number {
  const x = words(a);
  const y = words(b);
  if (!x.size || !y.size) return 0;
  let common = 0;
  for (const w of x) if (y.has(w)) common++;
  return common / Math.min(x.size, y.size);
}

/** The app subject a portal subject belongs to: same code, then same code family, then a close name. */
export function matchSubject(subjects: readonly Subject[], p: PortalSubject, taken: ReadonlySet<string> = new Set()): Subject | undefined {
  const free = subjects.filter((s) => !taken.has(s.id));
  const code = p.code.toUpperCase();
  return (
    free.find((s) => s.code && s.code.toUpperCase() === code) ??
    (code ? free.find((s) => s.code && codeFamily(s.code) === codeFamily(code)) : undefined) ??
    free
      .map((s) => ({ s, score: nameScore(s.name, p.name) }))
      .filter((x) => x.score >= 0.75)
      .sort((a, b) => b.score - a.score)[0]?.s
  );
}

export interface ImportRow {
  portal: PortalSubject;
  /** Existing subject, or undefined when a new one will be created. */
  subject?: Subject;
  percent: number;
  /** Current app figures for the matched subject (before import). */
  before?: { present: number; total: number };
}

export function planImport(state: CollegeState, snap: PortalSnapshot, current: (subjectId: string) => { present: number; total: number }): ImportRow[] {
  const taken = new Set<string>();
  return snap.subjects.map((p) => {
    const subject = matchSubject(state.subjects, p, taken);
    if (subject) taken.add(subject.id);
    return { portal: p, subject, percent: p.conducted ? (p.present / p.conducted) * 100 : 0, before: subject ? current(subject.id) : undefined };
  });
}

function shortName(name: string): string {
  const lab = /lab/i.test(name);
  const initials = name
    .replace(/&/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !/^(and|the|for|with|using|laboratory|lab)$/i.test(w))
    .map((w) => w[0].toUpperCase())
    .join('')
    .slice(0, 5);
  return `${initials || name.slice(0, 6)}${lab ? ' Lab' : ''}`;
}

/** Applies a snapshot: sets each subject's baseline (creating subjects that don't exist yet). */
export function applyImport(state: CollegeState, snap: PortalSnapshot, newId: () => string): CollegeState {
  const taken = new Set<string>();
  const subjects = [...state.subjects];
  const baseline: Record<string, AttendanceBaseline> = { ...(state.attendanceBaseline ?? {}) };
  for (const p of snap.subjects) {
    let subject = matchSubject(subjects, p, taken);
    if (!subject) {
      subject = { id: newId(), name: p.name || p.code, short: shortName(p.name || p.code), code: p.code || undefined, color: SUBJECT_COLORS[subjects.length % SUBJECT_COLORS.length] };
      subjects.push(subject);
    } else if (!subject.code && p.code) {
      const withCode: Subject = { ...subject, code: p.code };
      subjects[subjects.indexOf(subject)] = withCode;
      subject = withCode;
    }
    taken.add(subject.id);
    baseline[subject.id] = {
      present: p.present,
      total: p.conducted,
      asOf: snap.asOf,
      ...(p.remaining !== undefined ? { remaining: p.remaining } : {}),
      ...(p.faculty ? { faculty: p.faculty } : {}),
      absences: p.absences,
    };
  }
  return { ...state, subjects, attendanceBaseline: baseline, attendanceSyncedAt: snap.asOf > (state.attendanceSyncedAt ?? '') ? snap.asOf : state.attendanceSyncedAt };
}
