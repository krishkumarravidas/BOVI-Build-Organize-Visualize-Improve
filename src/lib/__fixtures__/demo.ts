/**
 * TEST-ONLY demo data (fictional). Never imported by the app: new installs start empty and go
 * through the setup screen.
 *
 * Morning slots without times in the source timetable were assigned by period order using the
 * Thursday/Friday pattern: 08:30, 09:25 | break | 10:40, 11:35 | lunch | 13:25, 14:20, 15:15 (55 min each).
 */
import { emptyCollege, type CollegeState, type Topic, type TimetableSlot } from '@/lib/college';
import type { ProjectsState } from '@/lib/projects';
import type { Weekday } from '@/lib/types';

const P = {
  p1: ['08:30', '09:25'],
  p2: ['09:25', '10:20'],
  p3: ['10:40', '11:35'],
  p4: ['11:35', '12:30'],
  p5: ['13:25', '14:20'],
} as const;

let n = 0;
const slot = (day: Weekday, [start, end]: readonly [string, string], s: Omit<TimetableSlot, 'id' | 'day' | 'start' | 'end'>): TimetableSlot => ({
  id: `seed-slot-${++n}`,
  day,
  start,
  end,
  ...s,
});

const MON = 1, TUE = 2, WED = 3, THU = 4, FRI = 5;

const topics = (prefix: string, titles: string[]): Topic[] =>
  titles.map((title, i) => ({ id: `seed-topic-${prefix}-${i + 1}`, title, done: false }));

export const seedCollege = (): CollegeState => {
  n = 0;
  return {
    ...emptyCollege(),
    version: 1,
    profile: 'Sem 3 · Section A',
    defaultRoom: 'Room 204',
    subjects: [
      { id: 'dsa', name: 'Data Structures & Algorithms', short: 'DSA', code: 'CS305', color: '#6E56CF' },
      { id: 'java', name: 'OOPS with Java', short: 'Java', code: 'CS303', color: '#D9822B' },
      { id: 'ai', name: 'Artificial Intelligence', short: 'AI', code: 'CS302', color: '#187A63' },
      { id: 'ddco', name: 'Digital Design & Computer Org.', short: 'DDCO', code: 'CS304', color: '#C2417A' },
      { id: 'psml', name: 'Probability & Statistics for ML', short: 'PSML', code: 'MA301', color: '#376FBE' },
      { id: 'sop', name: 'Societal Project', short: 'Societal', code: 'HS308', color: '#2E9BB5' },
      { id: 'aec', name: 'AEC Labs', short: 'AEC Lab', code: 'CSL307X', color: '#8E6C3A' },
      { id: 'lab', name: 'DSA / AI Lab', short: 'Lab', code: 'CSL306', color: '#5E6577' },
      { id: 'maths', name: 'Additional Maths-I', short: 'Add. Maths', code: 'MA310', color: '#B54A3C' },
    ],
    slots: [
      slot(MON, P.p1, { subjectId: 'dsa' }),
      slot(MON, P.p2, { subjectId: 'java' }),
      slot(MON, P.p3, { subjectId: 'ai' }),
      slot(MON, P.p4, { subjectId: 'ddco' }),
      slot(MON, P.p5, { subjectId: 'psml' }),
      slot(MON, ['14:20', '16:10'], { subjectId: 'sop' }),

      slot(TUE, P.p1, { subjectId: 'ddco' }),
      slot(TUE, P.p2, { subjectId: 'dsa' }),
      slot(TUE, P.p3, { subjectId: 'java' }),
      slot(TUE, P.p4, { subjectId: 'psml' }),
      slot(TUE, P.p5, { title: 'Proctoring' }),
      slot(TUE, ['14:20', '16:10'], { title: 'NCMC Yoga' }),

      slot(WED, P.p1, { subjectId: 'ai' }),
      slot(WED, P.p2, { subjectId: 'psml' }),
      slot(WED, P.p3, { subjectId: 'dsa' }),
      slot(WED, P.p4, { subjectId: 'ddco' }),
      slot(WED, ['13:25', '15:20'], { subjectId: 'aec' }),
      slot(WED, ['15:20', '16:10'], { title: 'Remedial' }),

      slot(THU, P.p1, { subjectId: 'java' }),
      slot(THU, P.p2, { subjectId: 'ai' }),
      slot(THU, P.p3, { subjectId: 'psml' }),
      slot(THU, P.p4, { subjectId: 'java', title: 'OOPS Tutorial' }),
      slot(THU, ['13:25', '16:10'], {
        subjectId: 'lab',
        title: 'DSA Lab B1 / AI Lab B2',
        note: 'DSA Lab B1 in TR-502; AI Lab B2 in BSN Kewin Aston Lab',
      }),

      slot(FRI, ['08:30', '10:20'], {
        subjectId: 'lab',
        title: 'DSA Lab B2 / AI Lab B1',
        note: 'DSA Lab B2 in BSN AI Computing Lab; AI Lab B1 in TR-502',
      }),
      slot(FRI, P.p3, { subjectId: 'java', title: 'OOPS Tutorial' }),
      slot(FRI, P.p4, { subjectId: 'psml', title: 'PSML Tutorial' }),
      slot(FRI, ['13:25', '15:15'], { subjectId: 'maths', room: 'Sir C V Raman Block, CR 302', note: 'Lateral entry only' }),
      slot(FRI, ['15:15', '15:30'], { title: 'Proctoring' }),
    ],
    changes: [],
    exams: [
      { id: 'ia1-psml', series: 'IA1', subjectId: 'psml', date: '2026-11-16', start: '09:30', end: '11:00', syllabus: 'Modules 1–2', topics: topics('psml', ['Module 1', 'Module 2']) },
      { id: 'ia1-ai', series: 'IA1', subjectId: 'ai', date: '2026-11-16', start: '14:00', end: '15:30', syllabus: 'Modules 1–2 up to Unification (Resolution not included)', topics: topics('ai', ['Module 1', 'Module 2 up to Unification']) },
      { id: 'ia1-java', series: 'IA1', subjectId: 'java', date: '2026-11-17', start: '09:30', end: '11:00' },
      { id: 'ia1-ddco', series: 'IA1', subjectId: 'ddco', title: 'DLCO (DDCO)', date: '2026-11-17', start: '14:00', end: '15:30', syllabus: 'Only up to latches and flip-flops (no registers)', topics: topics('ddco', ['Combinational logic', 'Latches', 'Flip-flops']) },
      { id: 'ia1-dsa', series: 'IA1', subjectId: 'dsa', date: '2026-11-18', start: '09:30', end: '11:00' },
      { id: 'ia1-maths', series: 'IA1', subjectId: 'maths', date: '2026-11-20', syllabus: 'Lateral entry only. Time not announced.' },
    ],
    events: [{ id: 'club-workshop', title: 'Robotics Workshop (club)', startDate: '2026-11-19', endDate: '2026-11-20' }],
  };
};

export const seedProjects = (): ProjectsState => ({
  version: 1,
  ideas: [],
  focus: [],
  activeFocus: null,
  projects: ([
    {
      id: 'shadow-hall',
      name: 'Shadow Hall',
      status: 'active',
      summary: 'PC · first-person horror',
      nextStep: 'Write the middle acts',
      notes: 'The one active project.',
      tasks: [
        { id: 't-acts', title: 'Write middle acts', done: false },
        { id: 't-enemy', title: 'Enemy AI', done: false },
        { id: 't-art', title: 'Concept art', done: false },
      ],
    },
    {
      id: 'rail-runner',
      name: 'Rail Runner',
      status: 'long-term',
      summary: 'Post-apocalyptic train game',
      nextStep: 'Rebuild the train system',
      tasks: [
        { id: 't-fuel', title: 'Fuel', done: false },
        { id: 't-seg', title: 'Segment transitions', done: false },
        { id: 't-cars', title: 'Car management', done: false },
      ],
    },
    { id: 'board-ghost', name: 'Board Ghost', status: 'concept', summary: 'Board-game horror', notes: 'After Shadow Hall.', tasks: [] },
    { id: 'portfolio', name: 'Portfolio site', status: 'planned', summary: 'Show finished work', nextStep: 'Start after exams', date: '2026-11-19', tasks: [] },
    { id: 'visualizer', name: 'Music visualizer', status: 'planned', nextStep: 'Start after exams', date: '2026-11-19', tasks: [] },
    { id: 'anim-test', name: 'Animation test', status: 'planned', summary: 'Hit-reaction animations', nextStep: 'After exams', tasks: [] },
    { id: 'vr-proto', name: 'VR prototype', status: 'paused', summary: 'Club project', nextStep: 'Talk with the club lead', date: '2026-11-21', tasks: [] },
    { id: 'puzzle', name: 'Puzzle game', status: 'parked', summary: 'Small puzzle game', notes: 'Parked for now.', tasks: [] },
    { id: 'studio-name', name: 'Studio name', status: 'decide', summary: 'Pick a studio name', nextStep: 'Decide, then buy the domain', date: '2026-12-01', tasks: [] },
  ] as Omit<ProjectsState['projects'][number], 'milestones' | 'log'>[]).map((p) => ({
    ...p,
    log: [],
    milestones:
      p.id === 'shadow-hall'
        ? [
            { id: 'm-k-acts', title: 'Full story outline (all acts)', done: false },
            { id: 'm-k-slice', title: 'Vertical slice', done: false },
            { id: 'm-k-steam', title: 'Steam Coming Soon page', done: false },
          ]
        : p.id === 'rail-runner'
          ? [{ id: 'm-im-train', title: 'Train system rebuilt', done: false }]
          : [],
  })),
});
