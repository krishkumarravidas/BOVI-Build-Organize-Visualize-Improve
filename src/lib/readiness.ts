import type { CollegeState, Exam } from './college';
import { topicProgress } from './collegeStats';
import { daysBetween, fromDateKey } from './dates';
import { cardStats, cardsFor } from './flashcards';
import type { ProjectsState } from './projects';
import { studyMinutes } from './study';
import type { DateKey } from './types';

export interface ReadinessPart {
  key: 'topics' | 'study' | 'sessions' | 'cards';
  label: string;
  /** 0–1. */
  value: number;
  weight: number;
  detail: string;
}

export interface Readiness {
  /** 0–100, or null when there's nothing to judge by yet. */
  score: number | null;
  parts: ReadinessPart[];
  daysLeft: number;
  verdict: 'ready' | 'getting-there' | 'behind' | 'unknown';
  /** One-line advice: the weakest part. */
  tip: string | null;
}

const STUDY_WINDOW_DAYS = 21;

/**
 * How ready you are for an exam, from what BOVI knows: syllabus topics revised, study time on the subject
 * (last 3 weeks vs. ~1 h per topic, 3–15 h), planned revision sessions done, and flashcards known.
 * Parts without data are left out and the rest re-weighted.
 */
export function examReadiness(college: CollegeState, projects: ProjectsState, exam: Exam, today: DateKey, now: number): Readiness {
  const parts: ReadinessPart[] = [];
  const t = topicProgress(exam);
  if (t.total) parts.push({ key: 'topics', label: 'Syllabus revised', value: t.done / t.total, weight: 40, detail: `${t.done}/${t.total} topics` });

  if (exam.subjectId) {
    const target = Math.min(900, Math.max(180, (t.total || 6) * 60));
    const from = Math.min(now, fromDateKey(today).getTime()) - STUDY_WINDOW_DAYS * 86_400_000;
    const min = studyMinutes(projects, exam.subjectId, from, now + 1);
    parts.push({ key: 'study', label: 'Study time', value: Math.min(1, min / target), weight: 25, detail: `${Math.round((min / 60) * 10) / 10} h of ~${Math.round(target / 60)} h (last 3 weeks)` });
  }

  const sessions = college.study.filter((s) => s.examId === exam.id);
  if (sessions.length) {
    const done = sessions.filter((s) => s.done).length;
    parts.push({ key: 'sessions', label: 'Revision sessions', value: done / sessions.length, weight: 15, detail: `${done}/${sessions.length} done` });
  }

  const cards = cardsFor(college.cards, { examId: exam.id }).length ? cardsFor(college.cards, { examId: exam.id }) : cardsFor(college.cards, { subjectId: exam.subjectId ?? '__none__' });
  const cs = cardStats(cards, today);
  if (cs.total && cs.masteredShare !== null) parts.push({ key: 'cards', label: 'Flashcards known', value: cs.masteredShare, weight: 20, detail: `${cs.mastered}/${cs.total} known` });

  const daysLeft = Math.max(0, daysBetween(today, exam.date));
  if (!parts.length) return { score: null, parts, daysLeft, verdict: 'unknown', tip: 'Add syllabus topics or study with the timer to get a readiness score.' };
  const totalWeight = parts.reduce((a, p) => a + p.weight, 0);
  const score = Math.round((parts.reduce((a, p) => a + p.value * p.weight, 0) / totalWeight) * 100);
  const verdict = score >= 75 ? 'ready' : score >= 45 ? 'getting-there' : 'behind';
  const weakest = [...parts].sort((a, b) => a.value - b.value)[0];
  const tip =
    weakest.value >= 0.9
      ? null
      : weakest.key === 'topics'
        ? 'Tick off more syllabus topics.'
        : weakest.key === 'study'
          ? 'Put in some study time on this subject.'
          : weakest.key === 'sessions'
            ? 'Catch up on your planned revision sessions.'
            : 'Review your flashcards.';
  return { score, parts, daysLeft, verdict, tip };
}

export const VERDICT_LABEL: Record<Readiness['verdict'], string> = { ready: 'Ready', 'getting-there': 'Getting there', behind: 'Behind', unknown: 'No data yet' };
