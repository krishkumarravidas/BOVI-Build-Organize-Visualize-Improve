import { atTime } from './dates';
import type { CollegeState } from './college';
import type { ProjectsState } from './projects';
import type { DateKey } from './types';

/** Study minutes per subject id for sessions starting in [fromMs, toMs). */
export function studyBySubject(projects: ProjectsState, fromMs: number, toMs: number): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of projects.focus) {
    if (!s.subjectId || s.start < fromMs || s.start >= toMs) continue;
    out.set(s.subjectId, (out.get(s.subjectId) ?? 0) + s.minutes);
  }
  return out;
}

export function studyMinutes(projects: ProjectsState, subjectId: string, fromMs: number, toMs: number): number {
  return studyBySubject(projects, fromMs, toMs).get(subjectId) ?? 0;
}

/**
 * After a study session on a subject, ticks off that day's earliest open revision session for one of the
 * subject's exams — if you studied at least half its planned length.
 */
export function tickStudyForFocus(college: CollegeState, subjectId: string, day: DateKey, minutes: number): CollegeState {
  const examIds = new Set(college.exams.filter((e) => e.subjectId === subjectId).map((e) => e.id));
  const candidates = college.study
    .filter((s) => !s.done && s.date === day && s.examId && examIds.has(s.examId))
    .sort((a, b) => a.start.localeCompare(b.start));
  const target = candidates.find((s) => {
    const planned = (atTime(s.date, s.end).getTime() - atTime(s.date, s.start).getTime()) / 60_000;
    return minutes >= Math.max(1, planned / 2);
  });
  if (!target) return college;
  return { ...college, study: college.study.map((s) => (s.id === target.id ? { ...s, done: true } : s)) };
}
