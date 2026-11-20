import { seedCollege, seedProjects } from '@/lib/__fixtures__/demo';

import { backupDue, backupFileName, backupsToPrune, baseName } from './autoBackup';
import { buildBriefing, planBriefings } from './briefing';
import { emptyCollege, type CollegeState, type Exam } from './college';
import { cardStats, dueCards, newCard, reviewCard } from './flashcards';
import { addHabit, createHabit, emptyState, setCompleted } from './habits';
import { emptyProjects, focusMinutesByProject, startFocus, stopFocus, toggleTask, upsertProject } from './projects';
import { examReadiness } from './readiness';
import { studyBySubject, tickStudyForFocus } from './study';
import { monthRange, summarize, summaryText } from './summary';
import { activityByDay, togglePick } from './gamedev';

const DAY = 86_400_000;

describe('study sessions', () => {
  it('are kept out of game-dev stats and counted per subject', () => {
    const t0 = new Date(2026, 10, 17, 10).getTime();
    let s = startFocus(seedProjects(), 'shadow-hall', 50, t0, 'Trees', 'dsa');
    expect(s.activeFocus).toMatchObject({ subjectId: 'dsa', projectId: undefined });
    s = stopFocus(s, t0 + 50 * 60_000, 'x');
    expect(s.focus[s.focus.length - 1]).toMatchObject({ subjectId: 'dsa', minutes: 50 });
    expect(studyBySubject(s, t0 - 1, t0 + DAY).get('dsa')).toBe(50);
    expect(focusMinutesByProject(s, t0 - 1, t0 + DAY).size).toBe(0);
    expect(activityByDay(s).size).toBe(0);
  });

  it('ticks off a planned revision session when you studied at least half of it', () => {
    const college: CollegeState = {
      ...seedCollege(),
      exams: [{ id: 'e', series: 'IA2', subjectId: 'dsa', date: '2026-11-25' }],
      study: [
        { id: 's1', examId: 'e', title: 'Rev', date: '2026-11-17', start: '18:00', end: '19:00', done: false },
        { id: 's2', examId: 'e', title: 'Rev', date: '2026-11-17', start: '20:00', end: '21:00', done: false },
      ],
    };
    expect(tickStudyForFocus(college, 'dsa', '2026-11-17', 20).study.every((x) => !x.done)).toBe(true);
    const after = tickStudyForFocus(college, 'dsa', '2026-11-17', 30);
    expect(after.study.map((x) => x.done)).toEqual([true, false]);
    expect(tickStudyForFocus(college, 'java', '2026-11-17', 60)).toBe(college);
  });
});

describe('flashcards', () => {
  it('moves cards through Leitner boxes', () => {
    let c = newCard({ id: 'c', front: ' Stack? ', back: 'LIFO' }, '2026-11-17');
    expect(c).toMatchObject({ front: 'Stack?', box: 1, due: '2026-11-17' });
    c = reviewCard(c, true, '2026-11-17', 1);
    expect(c).toMatchObject({ box: 2, due: '2026-11-19' });
    c = reviewCard(c, true, '2026-11-19', 2);
    expect(c).toMatchObject({ box: 3, due: '2026-11-23' });
    c = reviewCard(c, false, '2026-11-23', 3);
    expect(c).toMatchObject({ box: 1, due: '2026-11-24' });
  });

  it('lists due cards weakest first and reports mastery', () => {
    const cards = [
      { ...newCard({ id: 'a', front: 'a', back: 'a' }, '2026-11-10'), box: 4, due: '2026-11-17' },
      { ...newCard({ id: 'b', front: 'b', back: 'b' }, '2026-11-10'), box: 1, due: '2026-11-16' },
      { ...newCard({ id: 'c', front: 'c', back: 'c' }, '2026-11-10'), box: 5, due: '2026-12-01' },
    ];
    expect(dueCards(cards, '2026-11-17').map((x) => x.id)).toEqual(['b', 'a']);
    expect(cardStats(cards, '2026-11-17')).toEqual({ total: 3, due: 2, mastered: 2, masteredShare: 2 / 3 });
  });
});

describe('exam readiness', () => {
  const exam: Exam = { id: 'e', series: 'IA2', subjectId: 'dsa', date: '2026-11-27', topics: [{ id: 't1', title: 'Trees', done: true }, { id: 't2', title: 'Graphs', done: false }] };
  const now = new Date(2026, 10, 17, 12).getTime();

  it('combines topics, study time, sessions and cards, re-weighting what exists', () => {
    const college: CollegeState = { ...emptyCollege(), exams: [exam] };
    const r = examReadiness(college, emptyProjects(), exam, '2026-11-17', now);
    expect(r.parts.map((p) => p.key)).toEqual(['topics', 'study']);
    expect(r.score).toBe(Math.round(((0.5 * 40 + 0 * 25) / 65) * 100)); // 31
    expect(r.verdict).toBe('behind');
    expect(r.daysLeft).toBe(10);
    expect(r.tip).toMatch(/study time/);

    // 3 h of study (target max(180, 2×60) = 180) + all sessions done + all cards known.
    let p = emptyProjects();
    p = stopFocus(startFocus(p, undefined, 180, now - DAY, undefined, 'dsa'), now - DAY + 180 * 60_000, 'f');
    const full: CollegeState = {
      ...college,
      study: [{ id: 's', examId: 'e', title: 'r', date: '2026-11-16', start: '18:00', end: '19:00', done: true }],
      cards: [{ ...newCard({ id: 'c', front: 'f', back: 'b', examId: 'e' }, '2026-11-01'), box: 5 }],
    };
    const r2 = examReadiness(full, p, exam, '2026-11-17', now);
    expect(r2.parts.map((x) => x.key)).toEqual(['topics', 'study', 'sessions', 'cards']);
    expect(r2.score).toBe(Math.round(((0.5 * 40 + 1 * 25 + 1 * 15 + 1 * 20) / 100) * 100)); // 80
    expect(r2.verdict).toBe('ready');
  });

  it('says so when there is nothing to judge by', () => {
    const r = examReadiness(emptyCollege(), emptyProjects(), { id: 'x', series: 'IA1', date: '2026-11-20' }, '2026-11-17', now);
    expect(r).toMatchObject({ score: null, verdict: 'unknown' });
  });
});

describe('morning briefing', () => {
  it('summarises classes, exams, deadlines, habits and the game-dev plan', () => {
    let habits = addHabit(emptyState(), createHabit({ name: 'Read' }, '2026-11-01', 'h'));
    habits = setCompleted(habits, 'h', '2026-11-16', true);
    const college = { ...seedCollege(), assignments: [{ id: 'a', title: 'Lab record', due: '2026-11-17', done: false }] };
    let projects = seedProjects();
    const task = projects.projects[0].tasks[0];
    projects = togglePick(projects, { week: '2026-11-16', projectId: projects.projects[0].id, taskId: task.id });
    const b = buildBriefing('2026-11-16', { college, habitState: habits, projects });
    expect(b.title).toMatch(/: \d+ classes from 8:30$/);
    expect(b.body).toMatch(/^Classes: DSA 8:30, Java 9:25/);
    expect(b.body).toContain('Due: Lab record (tomorrow)');
    expect(b.body).toContain('1 habit today');
    expect(b.body).toContain('Projects this week: 0/1 done');
    expect(buildBriefing('2026-11-16', { college, habitState: habits, projects, projectsLabel: 'Game dev' }).body).toContain('Game dev this week: 0/1 done');
  });

  it('plans the next 7 mornings, skipping a time already passed today', () => {
    const r = planBriefings(new Date(2026, 10, 16, 9), '07:30', { college: emptyCollege(), habitState: emptyState(), projects: emptyProjects() });
    expect(r).toHaveLength(6);
    expect(r[0]).toMatchObject({ id: 'briefing:2026-11-17', date: new Date(2026, 10, 17, 7, 30) });
    expect(r[0].body).toMatch(/Nothing scheduled/);
    expect(planBriefings(new Date(), null, { college: emptyCollege(), habitState: emptyState(), projects: emptyProjects() })).toEqual([]);
  });
});

describe('period summary and report', () => {
  it('counts the week across college and game dev', () => {
    let projects = upsertProject(emptyProjects(), { id: 'g', name: 'Shadow Hall', status: 'active', tasks: [{ id: 't', title: 'AI', done: false }] });
    projects = toggleTask(projects, 'g', 't', new Date(2026, 10, 18, 10).getTime());
    projects = stopFocus(startFocus(projects, 'g', 60, new Date(2026, 10, 18, 11).getTime()), new Date(2026, 10, 18, 12).getTime(), 'f1');
    projects = stopFocus(startFocus(projects, undefined, 30, new Date(2026, 10, 19, 18).getTime(), undefined, 'dsa'), new Date(2026, 10, 19, 18, 30).getTime(), 'f2');
    projects = { ...projects, bugs: [{ id: 'b', projectId: 'g', title: 'x', severity: 'low', status: 'fixed', createdAt: 0, fixedAt: new Date(2026, 10, 20).getTime() }], builds: [{ id: 'v', projectId: 'g', version: '0.2.0', date: '2026-11-21', notes: '' }] };
    const college = { ...emptyCollege(), attendance: [{ date: '2026-11-17', key: 'k', subjectId: 'dsa', status: 'present' as const }, { date: '2026-11-18', key: 'k2', subjectId: 'dsa', status: 'absent' as const }] };
    const s = summarize('2026-11-16', '2026-11-22', { college, habitState: emptyState(), projects });
    expect(s).toMatchObject({ studyMin: 30, gamedevMin: 60, tasksDone: 1, bugsFixed: 1, builds: ['Shadow Hall 0.2.0'], attendance: { present: 1, total: 2 }, gamedevDays: 3, topProject: { name: 'Shadow Hall', minutes: 60 } });
    const text = summaryText('Week of 16 Nov', s);
    expect(text).toContain('Projects: 1 h focus on 3 days (most on Shadow Hall)');
    expect(summaryText('Week', s, 'Work')).toContain('Work: 1 h focus');
    expect(text).toContain('Shipped: Shadow Hall 0.2.0');
    expect(text).toContain('Attendance: 50% (1/2)');
  });

  it('computes month ranges', () => {
    expect(monthRange('2026-11')).toEqual({ from: '2026-11-01', to: '2026-11-30' });
    expect(monthRange('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });
});

describe('auto-backup', () => {
  it('is due weekly, names files by date and prunes the oldest', () => {
    expect(backupDue(null, 5)).toBe(true);
    expect(backupDue(0, 6 * DAY)).toBe(false);
    expect(backupDue(0, 7 * DAY)).toBe(true);
    expect(backupFileName(new Date(2026, 10, 17))).toBe('bovi-backup-2026-11-17.json');
    const names = Array.from({ length: 10 }, (_, i) => `bovi-backup-2026-0${Math.floor(i / 9) + 1}-${String((i % 9) + 10)}.json`).concat(['notes.txt']);
    expect(backupsToPrune(names)).toEqual(['bovi-backup-2026-01-10.json', 'bovi-backup-2026-01-11.json']);
    expect(baseName('primary%3ADownload%2FBOVI%2Fbovi-backup-2026-11-17.json')).toBe('bovi-backup-2026-11-17.json');
    expect(baseName('bovi-backup-2026-11-17.json')).toBe('bovi-backup-2026-11-17.json');
  });
});
