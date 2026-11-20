import { subjectName, upcomingExams, type CollegeState } from './college';
import { addDays, atTime, toDateKey } from './dates';

export interface DatedReminder {
  /** Stable id, e.g. `exam:ia1-psml:eve`. */
  id: string;
  title: string;
  body: string;
  date: Date;
}

export const EXAM_EVENING_TIME = '20:00';
export const EXAM_LEAD_MINUTES = 60;
/** Used when an exam's time isn't known yet. */
export const EXAM_TBA_MORNING_TIME = '07:30';

/**
 * Two one-shot reminders per upcoming exam: the evening before (with portions and clashes) and
 * shortly before it starts. Reminders already in the past are skipped.
 */
export function planExamReminders(college: CollegeState, now: Date): DatedReminder[] {
  const out: DatedReminder[] = [];
  for (const { exam, clashes } of upcomingExams(college, toDateKey(now))) {
    const name = subjectName(college, exam.subjectId, exam.title);
    const when = exam.start ? `${exam.start}${exam.end ? `–${exam.end}` : ''}` : 'time TBA';
    const portions = exam.syllabus ? ` Portions: ${exam.syllabus}` : '';
    const clash = clashes.length ? ` Clashes with ${clashes.join(', ')}.` : '';
    const room = exam.room ? ` · ${exam.room}` : '';

    out.push({
      id: `exam:${exam.id}:eve`,
      title: `${exam.series} tomorrow: ${name}`,
      body: `${when}${room}.${portions}${clash}`.trim(),
      date: atTime(addDays(exam.date, -1), EXAM_EVENING_TIME),
    });

    const soon = exam.start
      ? new Date(atTime(exam.date, exam.start).getTime() - EXAM_LEAD_MINUTES * 60_000)
      : atTime(exam.date, EXAM_TBA_MORNING_TIME);
    out.push({
      id: `exam:${exam.id}:soon`,
      title: exam.start ? `${name} ${exam.series} in 1 hour` : `${name} ${exam.series} today`,
      body: `${when}${room}. All the best!`,
      date: soon,
    });
  }
  return out.filter((r) => r.date.getTime() > now.getTime()).sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** One reminder the evening before each open assignment's due date. */
export function planAssignmentReminders(college: CollegeState, now: Date): DatedReminder[] {
  return college.assignments
    .filter((a) => !a.done)
    .map((a) => {
      const subject = a.subjectId ? college.subjects.find((s) => s.id === a.subjectId)?.short : undefined;
      return {
        id: `assignment:${a.id}:eve`,
        title: `Due tomorrow: ${a.title}`,
        body: [subject, a.notes].filter(Boolean).join(' · ') || 'Finish and submit it tomorrow.',
        date: atTime(addDays(a.due, -1), EXAM_EVENING_TIME),
      };
    })
    .filter((r) => r.date.getTime() > now.getTime());
}
