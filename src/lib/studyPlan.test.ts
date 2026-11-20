import { seedCollege } from '@/lib/__fixtures__/demo';

import type { AgendaEvent } from './agenda';
import { planRevision } from './studyPlan';

let n = 0;
const id = () => `p${++n}`;
const dsaExam = () => seedCollege().exams.find((e) => e.id === 'ia1-dsa')!; // Wed 18 Nov 09:30

describe('planRevision', () => {
  it('spreads sessions over the days before the exam, in study windows, after classes', () => {
    const now = new Date(2026, 10, 15, 8, 0); // Sunday morning
    const plan = planRevision(dsaExam(), seedCollege(), [], [], { sessions: 3, minutes: 60, now }, id);
    expect(plan.map((s) => [s.date, s.start, s.end])).toEqual([
      ['2026-11-15', '09:00', '10:00'], // Sunday: weekend window
      ['2026-11-16', '17:30', '18:30'], // Monday evening (classes end 16:10)
      ['2026-11-17', '17:30', '18:30'], // Tuesday evening, day before
    ]);
    expect(plan[0].title).toBe('Revise Data Structures & Algorithms (1/3)');
    expect(plan.every((s) => s.examId === 'ia1-dsa' && !s.done)).toBe(true);
  });

  it('uses syllabus topics as session titles', () => {
    const college = seedCollege();
    const psml = college.exams.find((e) => e.id === 'ia1-ai')!; // Mon 16 Nov; topics Module 1, Module 2...
    const plan = planRevision(psml, college, [], [], { sessions: 2, minutes: 45, now: new Date(2026, 10, 15, 8) }, id);
    expect(plan.map((s) => s.title)).toEqual(['Revise Artificial Intelligence: Module 1', 'Revise Artificial Intelligence: Module 2 up to Unification']);
    expect(plan.every((s) => s.date === '2026-11-15')).toBe(true); // only Sunday is before the exam
  });

  it('avoids schedule blocks, calendar events and existing sessions', () => {
    const college = seedCollege();
    college.study.push({ id: 'x', title: 'Old', date: '2026-11-17', start: '17:30', end: '18:30', done: false });
    const gym = { id: 'g', title: 'Gym', days: [1 as const], start: '17:00', end: '19:00', remind: false };
    const party: AgendaEvent = { id: 'e', calendarId: 'c', title: 'Party', start: new Date(2026, 10, 15, 8), end: new Date(2026, 10, 15, 13), allDay: false };
    const plan = planRevision(dsaExam(), college, [gym], [party], { sessions: 3, minutes: 60, now: new Date(2026, 10, 15, 7) }, id);
    expect(plan.map((s) => [s.date, s.start])).toEqual([
      ['2026-11-15', '13:30'], // after the party + 15 min buffer, on the half hour
      ['2026-11-16', '19:30'], // after gym
      ['2026-11-17', '19:00'], // after the existing session
    ]);
  });

  it('returns nothing for past exams or when asking for zero sessions', () => {
    const now = new Date(2026, 10, 19, 8);
    expect(planRevision(dsaExam(), seedCollege(), [], [], { sessions: 3, minutes: 60, now }, id)).toEqual([]);
    expect(planRevision(dsaExam(), seedCollege(), [], [], { sessions: 0, minutes: 60, now: new Date(2026, 10, 15) }, id)).toEqual([]);
  });

  it('packs extra sessions into days with room when there are fewer days than sessions', () => {
    const plan = planRevision(dsaExam(), seedCollege(), [], [], { sessions: 5, minutes: 60, now: new Date(2026, 10, 16, 8) }, id);
    expect(plan).toHaveLength(5);
    expect(new Set(plan.map((s) => s.date))).toEqual(new Set(['2026-11-16', '2026-11-17']));
  });
});
