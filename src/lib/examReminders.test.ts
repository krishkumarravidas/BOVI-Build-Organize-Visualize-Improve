import { seedCollege } from '@/lib/__fixtures__/demo';

import { planExamReminders } from './examReminders';

describe('planExamReminders', () => {
  it('plans an evening-before and a 1-hour-before reminder per upcoming exam', () => {
    const now = new Date(2026, 10, 15, 8, 0); // Sun 15 Nov, 08:00
    const plans = planExamReminders(seedCollege(), now);
    const psml = plans.filter((p) => p.id.startsWith('exam:ia1-psml'));
    expect(psml.map((p) => [p.id, p.date])).toEqual([
      ['exam:ia1-psml:eve', new Date(2026, 10, 15, 20, 0)],
      ['exam:ia1-psml:soon', new Date(2026, 10, 16, 8, 30)],
    ]);
    expect(psml[0]).toMatchObject({
      title: 'IA1 tomorrow: Probability & Statistics for ML',
      body: '09:30–11:00. Portions: Modules 1–2',
    });
    expect(plans).toHaveLength(12);
  });

  it('includes clashes and uses a morning reminder when the time is TBA', () => {
    const plans = planExamReminders(seedCollege(), new Date(2026, 10, 15, 8, 0));
    const maths = plans.filter((p) => p.id.startsWith('exam:ia1-maths'));
    expect(maths[0].body).toContain('Clashes with Robotics Workshop (club).');
    expect(maths[1]).toMatchObject({ title: 'Additional Maths-I IA1 today', date: new Date(2026, 10, 20, 7, 30) });
  });

  it('skips reminders that are already in the past', () => {
    const plans = planExamReminders(seedCollege(), new Date(2026, 10, 16, 9, 0)); // Mon 09:00
    expect(plans.some((p) => p.id.startsWith('exam:ia1-psml'))).toBe(false); // both PSML reminders passed
    expect(plans.find((p) => p.id === 'exam:ia1-ai:soon')?.date).toEqual(new Date(2026, 10, 16, 13, 0));
    expect(plans.some((p) => p.id === 'exam:ia1-ai:eve')).toBe(false);
  });
});

describe('planAssignmentReminders', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { planAssignmentReminders } = require('./examReminders');
  it('reminds the evening before open assignments only', () => {
    const c = seedCollege();
    c.assignments = [
      { id: 'a', subjectId: 'dsa', title: 'Lab record', due: '2026-11-17', done: false, notes: 'Programs 1–5' },
      { id: 'b', title: 'Done', due: '2026-11-17', done: true },
      { id: 'c', title: 'Past', due: '2026-11-15', done: false },
    ];
    expect(planAssignmentReminders(c, new Date(2026, 10, 15, 8))).toEqual([
      { id: 'assignment:a:eve', title: 'Due tomorrow: Lab record', body: 'DSA · Programs 1–5', date: new Date(2026, 10, 16, 20, 0) },
    ]);
  });
});
