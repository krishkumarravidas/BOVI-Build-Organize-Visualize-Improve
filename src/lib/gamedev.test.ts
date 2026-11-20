import { seedProjects } from '@/lib/__fixtures__/demo';

import {
  activityByDay,
  assetTotals,
  changelog,
  creditsText,
  daysSinceActive,
  deleteProjectData,
  featuredJam,
  forecast,
  gamedevDueOn,
  formatCountdown,
  jamHeadline,
  heatmapWeeks,
  jamPhases,
  jamReminders,
  jamStatus,
  launchItems,
  nextPlanReminder,
  nextVersion,
  nudgeFor,
  playtestSummary,
  prunePlan,
  removeItem,
  scopeCheck,
  setBugStatus,
  setFeatures,
  setLaunchItem,
  sortedBugs,
  streak,
  togglePick,
  upsertItem,
  weekTasks,
  weeklyFocusHours,
  weeklyStats,
  wishlistRate,
  type Bug,
  type Feature,
  type GameJam,
} from './gamedev';
import { gamedevReminders } from './gamedevReminders';
import { commitDays, parseCommits, parseRepo, projectRepo } from './github';
import { emptyProjects, migrateProjects, startFocus, stopFocus, toggleMilestone, toggleTask, upsertProject, type ProjectsState } from './projects';

const DAY = 86_400_000;
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();

const base = (): ProjectsState => {
  let s = upsertProject(emptyProjects(), { id: 'g', name: 'Shadow Hall', status: 'active', tasks: [{ id: 't1', title: 'AI', done: false }, { id: 't2', title: 'Menu', done: false }] });
  s = upsertProject(s, { id: 'h', name: 'Iron', status: 'planned', tasks: [] });
  return s;
};
const f = (id: string, priority: Feature['priority'], size: Feature['size'], done = false): Feature => ({ id, title: id, priority, size, done });

describe('scope check', () => {
  const features = [f('a', 'must', 'L'), f('b', 'must', 'M'), f('c', 'should', 'M'), f('d', 'could', 'L'), f('e', 'could', 'S'), f('x', 'must', 'L', true), f('z', 'cut', 'L')];

  it('sums open hours per priority, ignoring done and cut-line totals separately', () => {
    const s = scopeCheck(features, undefined, 0, '2026-11-17');
    expect(s.hours).toEqual({ must: 42, should: 12, could: 34, cut: 30 });
    expect(s.capacity).toBeNull();
    expect(s.assumedPace).toBe(true);
  });

  it('suggests cutting the largest Coulds first, then Shoulds, until it fits', () => {
    // 10 weeks × 6 h (assumed) = 60 h; need 42+12+34 = 88.
    const s = scopeCheck(features, '2027-01-26', 0, '2026-11-17');
    expect(s.capacity).toBeCloseTo(60);
    expect(s.fits).toBe(false);
    expect(s.mustFits).toBe(true);
    expect(s.suggestCuts.map((x) => x.id)).toEqual(['d']); // 88 - 30 = 58 ≤ 60
  });

  it('uses the measured pace and flags when even the Musts don’t fit', () => {
    const s = scopeCheck(features, '2026-12-01', 10, '2026-11-17'); // 2 weeks × 10 h
    expect(s.assumedPace).toBe(false);
    expect(s.mustFits).toBe(false);
    expect(s.suggestCuts.map((x) => x.id)).toEqual(['d', 'e', 'c']);
  });

  it('measures weekly focus hours from sessions', () => {
    let s = base();
    const now = at(2026, 11, 17);
    s = { ...s, focus: [{ id: '1', projectId: 'g', start: now - 3 * DAY, minutes: 240 }, { id: '2', projectId: 'g', start: now - 40 * DAY, minutes: 600 }, { id: '3', projectId: 'h', start: now - DAY, minutes: 60 }] };
    expect(weeklyFocusHours(s, 'g', now)).toBe(1); // 4 h over 4 weeks
  });
});

describe('features, tasks and velocity', () => {
  it('stamps doneAt on tasks/milestones/features and counts them per week', () => {
    let s = base();
    s = toggleTask(s, 'g', 't1', at(2026, 11, 10));
    s = setFeatures(s, 'g', () => [{ ...f('a', 'must', 'S', true), doneAt: at(2026, 11, 16) }, f('b', 'must', 'M')]);
    s = { ...s, projects: s.projects.map((p) => (p.id === 'g' ? { ...p, milestones: [{ id: 'm', title: 'Slice', done: false }] } : p)) };
    s = toggleMilestone(s, 'g', 'm', at(2026, 11, 17));
    expect(s.projects[0].tasks[0]).toMatchObject({ done: true, doneAt: at(2026, 11, 10) });
    const stats = weeklyStats(s, 'g', '2026-11-17', 3);
    expect(stats.map((w) => [w.week, w.done])).toEqual([
      ['2026-11-02', 0],
      ['2026-11-09', 1],
      ['2026-11-16', 2],
    ]);
    // Unticking clears the stamp.
    expect(toggleTask(s, 'g', 't1').projects[0].tasks[0].doneAt).toBeUndefined();
  });

  it('forecasts from the last 4 full weeks', () => {
    const stats = [5, 2, 2, 2, 2, 9].map((done, i) => ({ week: `w${i}`, done, focusMin: 0 }));
    expect(forecast(4, stats, '2026-11-17')).toEqual({ perWeek: 2, date: '2026-12-01' });
    expect(forecast(4, stats.map((x) => ({ ...x, done: 0 })), '2026-11-17').date).toBeNull();
    expect(forecast(0, stats, '2026-11-17').date).toBe('2026-11-17');
  });
});

describe('weekly plan', () => {
  it('toggles picks, resolves tasks and prunes old weeks', () => {
    let s = base();
    s = togglePick(s, { week: '2026-11-16', projectId: 'g', taskId: 't1' });
    s = togglePick(s, { week: '2026-11-16', projectId: 'g', taskId: 'gone' });
    s = togglePick(s, { week: '2026-08-03', projectId: 'g', taskId: 't2' });
    expect(weekTasks(s, '2026-11-16').map((x) => x.task.title)).toEqual(['AI']);
    s = togglePick(s, { week: '2026-11-16', projectId: 'g', taskId: 't1' });
    expect(weekTasks(s, '2026-11-16')).toEqual([]);
    expect(prunePlan(s, '2026-11-17').weekPlan!.some((p) => p.week === '2026-08-03')).toBe(false);
  });

  it('reminds on the coming Sunday at 18:00', () => {
    expect(nextPlanReminder(new Date(2026, 10, 17, 9))).toEqual(new Date(2026, 10, 22, 18)); // Tue → Sun
    expect(nextPlanReminder(new Date(2026, 10, 22, 17))).toEqual(new Date(2026, 10, 22, 18));
    expect(nextPlanReminder(new Date(2026, 10, 22, 19))).toEqual(new Date(2026, 10, 29, 18));
  });
});

describe('collections, bugs, builds, assets', () => {
  it('upserts/removes items and deletes a project’s data with it', () => {
    let s = base();
    const bug: Bug = { id: 'b1', projectId: 'g', title: 'Falls through floor', severity: 'high', status: 'open', createdAt: 1 };
    s = upsertItem(s, 'bugs', bug);
    s = upsertItem(s, 'bugs', { ...bug, title: 'Falls through stairs' });
    s = upsertItem(s, 'learning', { id: 'l', title: 'AI course', status: 'todo', createdAt: '2026-11-17', projectId: 'g' });
    expect(s.bugs).toHaveLength(1);
    expect(s.bugs![0].title).toBe('Falls through stairs');
    const d = deleteProjectData(s, 'g');
    expect(d.bugs).toEqual([]);
    expect(d.learning![0].projectId).toBeUndefined();
    expect(removeItem(s, 'bugs', 'b1').bugs).toEqual([]);
  });

  it('sorts bugs open-first by severity and stamps fixes', () => {
    const mk = (id: string, severity: Bug['severity'], status: Bug['status'], createdAt: number): Bug => ({ id, projectId: 'g', title: id, severity, status, createdAt });
    const list = [mk('a', 'low', 'open', 1), mk('b', 'crash', 'fixed', 2), mk('c', 'crash', 'open', 3), mk('d', 'low', 'open', 4)];
    expect(sortedBugs(list).map((b) => b.id)).toEqual(['c', 'd', 'a', 'b']);
    const s = setBugStatus({ ...base(), bugs: list }, 'a', 'fixed', 99);
    expect(s.bugs!.find((b) => b.id === 'a')).toMatchObject({ status: 'fixed', fixedAt: 99 });
    expect(setBugStatus(s, 'a', 'open', 100).bugs!.find((b) => b.id === 'a')!.fixedAt).toBeUndefined();
  });

  it('bumps versions and writes a changelog since the last build', () => {
    expect(nextVersion(undefined)).toBe('0.1.0');
    expect(nextVersion('0.3.1')).toBe('0.3.2');
    expect(nextVersion('v1.9')).toBe('v1.10');
    expect(nextVersion('demo')).toBe('demo-2');
    let s = base();
    s = toggleTask(s, 'g', 't1', 50);
    s = toggleTask(s, 'g', 't2', 5);
    s = { ...s, bugs: [{ id: 'b', projectId: 'g', title: 'Crash on load', severity: 'crash', status: 'fixed', createdAt: 1, fixedAt: 60 }] };
    expect(changelog(s, 'g', 10, 100)).toBe('• AI\nFixed: Crash on load');
  });

  it('totals assets and writes credits for used ones', () => {
    const assets = [
      { id: '1', projectId: 'g', name: 'Forest kit', source: 'Fab' as const, cost: 1200, status: 'used' as const, author: 'Studio X', license: 'Standard' },
      { id: '2', projectId: 'g', name: 'Rain VFX', source: 'Marketplace' as const, cost: 500, status: 'unused' as const },
    ];
    expect(assetTotals(assets)).toEqual({ count: 2, spent: 1700, unused: 1, unusedSpent: 500 });
    expect(creditsText('Shadow Hall', assets)).toBe('Shadow Hall — third-party assets\n- Forest kit by Studio X (Fab, Standard)');
  });

  it('summarises playtests', () => {
    expect(
      playtestSummary([
        { id: '1', projectId: 'g', date: '2026-11-01', tester: 'Ravi', fun: 4 },
        { id: '2', projectId: 'g', date: '2026-11-02', tester: 'ravi ', fun: 2 },
        { id: '3', projectId: 'g', date: '2026-11-03', tester: 'Asha' },
      ]),
    ).toEqual({ count: 3, avgFun: 3, testers: 2 });
  });
});

describe('launch checklist and wishlists', () => {
  it('schedules items back from the launch date, with overrides and late flags', () => {
    let s = base();
    s = { ...s, projects: s.projects.map((p) => (p.id === 'g' ? { ...p, launchDate: '2027-10-01' } : p)) };
    let items = launchItems(s.projects[0], '2027-03-01');
    expect(items[0]).toMatchObject({ key: 'steam-direct', date: '2026-12-05', late: true });
    expect(items[items.length - 1]).toMatchObject({ key: 'patch', date: '2027-10-08' });
    s = setLaunchItem(s, 'g', 'steam-direct', { done: true }, 7);
    s = setLaunchItem(s, 'g', 'next-fest', { date: '2027-06-08' }, 8);
    items = launchItems(s.projects[0], '2027-03-01');
    expect(items.find((i) => i.key === 'steam-direct')).toMatchObject({ done: true, late: false });
    expect(items.find((i) => i.key === 'next-fest')!.date).toBe('2027-06-08');
    expect(s.projects[0].launch!['steam-direct'].doneAt).toBe(7);
    // No launch date: undated.
    expect(launchItems(base().projects[0], '2027-03-01')[0].date).toBeNull();
  });

  it('computes the weekly wishlist rate from the last two entries', () => {
    const e = (date: string, wishlists: number) => ({ id: date, projectId: 'g', date, wishlists });
    expect(wishlistRate([e('2026-11-01', 100)])).toBeNull();
    expect(wishlistRate([e('2026-11-15', 240), e('2026-11-01', 100), e('2026-11-08', 170)])).toBe(70);
  });
});

describe('game jams', () => {
  const jam: GameJam = { id: 'j', name: 'GMTK', start: at(2026, 11, 20, 18), hours: 48 };

  it('splits the jam into phases covering the whole window', () => {
    const p = jamPhases(jam);
    expect(p[0].start).toBe(jam.start);
    expect(p[p.length - 1].end).toBe(jam.start + 48 * 3_600_000);
    expect(p[1].title).toMatch(/prototype/i);
  });

  it('reports status and picks the featured jam', () => {
    expect(jamStatus(jam, jam.start - 1000)).toEqual({ state: 'upcoming', msToStart: 1000 });
    const running = jamStatus(jam, jam.start + 3 * 3_600_000); // brainstorm is the first 2.4 h
    expect(running.state === 'running' && running.phase.title).toMatch(/prototype/i);
    expect(jamStatus(jam, jam.start + 49 * 3_600_000).state).toBe('ended');
    expect(featuredJam([jam], jam.start - 3 * DAY)?.id).toBe('j');
    expect(featuredJam([jam], jam.start - 20 * DAY)).toBeUndefined();
  });

  it('formats countdowns and headlines', () => {
    expect(formatCountdown(3 * DAY + 4 * 3_600_000 + 5 * 60_000)).toBe('3d 4h');
    expect(formatCountdown(5 * 3_600_000 + 20 * 60_000)).toBe('5h 20m');
    expect(formatCountdown(12 * 60_000)).toBe('12m');
    expect(jamHeadline(jam, jam.start - 2 * DAY)).toBe('GMTK starts in 2d');
    expect(jamHeadline(jam, jam.start + 47 * 3_600_000)).toMatch(/^GMTK: 1h left · /);
  });

  it('schedules start, scope-check and submit reminders still in the future', () => {
    const r = jamReminders([jam], new Date(jam.start + 20 * 3_600_000));
    expect(r.map((x) => x.id)).toEqual(['jam:j:submit']);
    expect(r[0].date.getTime()).toBe(jam.start + 46 * 3_600_000);
  });
});

describe('activity', () => {
  it('builds per-day activity, streaks and idle days', () => {
    let s = base();
    s = { ...s, focus: [{ id: '1', projectId: 'g', start: at(2026, 11, 16), minutes: 25 }] };
    s = toggleTask(s, 'g', 't1', at(2026, 11, 15));
    s = { ...s, projects: s.projects.map((p) => (p.id === 'g' ? { ...p, log: [{ id: 'l', date: '2026-11-14', text: 'x' }] } : p)) };
    const days = activityByDay(s, 'g', ['2026-11-10']);
    expect([...days.keys()].sort()).toEqual(['2026-11-10', '2026-11-14', '2026-11-15', '2026-11-16']);
    expect(streak(days, '2026-11-17')).toBe(3); // 14,15,16 — today not yet
    expect(streak(days, '2026-11-18')).toBe(0);
    expect(daysSinceActive(days, '2026-11-19')).toBe(3);
    expect(daysSinceActive(activityByDay(s, 'h'), '2026-11-19')).toBeNull();
    expect(nudgeFor('Shadow Hall', 3)).toBe('3 days without touching Shadow Hall.');
    expect(nudgeFor('Shadow Hall', 2)).toBeNull();
  });

  it('lays out the heatmap as Monday-first week columns', () => {
    const w = heatmapWeeks('2026-11-17', 3);
    expect(w).toHaveLength(3);
    expect(w[2][0]).toBe('2026-11-16');
    expect(w[0][0]).toBe('2026-11-02');
  });
});

describe('focus session notes and migration', () => {
  it('keeps the intent as the session note', () => {
    let s = startFocus(base(), 'g', 25, 0, '  Enemy patrol  ');
    expect(s.activeFocus!.intent).toBe('Enemy patrol');
    s = stopFocus(s, 25 * 60_000, 'f1');
    expect(s.focus[0].note).toBe('Enemy patrol');
  });

  it('migrates workspace collections only when present', () => {
    const plain = migrateProjects(JSON.parse(JSON.stringify(seedProjects())))!;
    expect('bugs' in plain).toBe(false);
    const withBugs = migrateProjects({ ...seedProjects(), bugs: [{ id: 'b' }], jams: 'nope' })!;
    expect(withBugs.bugs).toEqual([{ id: 'b' }]);
    expect(withBugs.jams).toEqual([]);
  });
});

describe('github', () => {
  it('parses repo links and picks the project repo', () => {
    expect(parseRepo('https://github.com/me/game.git')).toEqual({ owner: 'me', repo: 'game' });
    expect(parseRepo('https://github.com/me')).toBeNull();
    expect(parseRepo('https://gitlab.com/me/game')).toBeNull();
    const p = { ...base().projects[0], links: [{ id: 'a', title: 'Docs', url: 'https://docs.google.com/d' }, { id: 'b', title: 'r1', url: 'https://github.com/me/one' }, { id: 'c', title: 'r2', url: 'https://github.com/me/two' }] };
    expect(projectRepo(p)!.ref.repo).toBe('one');
    expect(projectRepo({ ...p, repoLinkId: 'c' })!.ref.repo).toBe('two');
  });

  it('parses API commits and their days', () => {
    const commits = parseCommits([
      { sha: 'a1', html_url: 'u', commit: { message: 'Add AI\n\nlong body', author: { name: 'K', date: '2026-11-16T10:00:00Z' } }, author: { login: 'demo' } },
      { nope: true },
    ]);
    expect(commits).toEqual([{ sha: 'a1', message: 'Add AI', date: '2026-11-16T10:00:00Z', author: 'demo', url: 'u' }]);
    expect(commitDays(commits)).toHaveLength(1);
    expect(parseCommits({ message: 'Not Found' })).toEqual([]);
  });
});

describe('calendar due items', () => {
  it('lists milestones due, launch steps and jams on a day', () => {
    let s = base();
    s = { ...s, projects: s.projects.map((p) => (p.id === 'g' ? { ...p, launchDate: '2027-10-01', milestones: [{ id: 'm', title: 'Demo', due: '2027-05-04', done: false }] } : p)), jams: [{ id: 'j', name: 'GMTK', start: new Date(2027, 4, 4, 18).getTime(), hours: 48 }] };
    expect(gamedevDueOn(s, '2027-05-04').map((d) => d.kind)).toEqual(['milestone', 'launch', 'jam']); // 'demo' is launch − 150
    expect(gamedevDueOn(s, '2027-05-05')).toEqual([]);
  });
});

describe('game dev reminders', () => {
  /* Plan reminder skipped once next week is planned; launch steps within 30 days at 09:00. */
  it('schedules planning, jam and launch reminders', () => {
    let s = base();
    s = { ...s, projects: s.projects.map((p) => (p.id === 'g' ? { ...p, launchDate: '2026-12-17' } : p)), jams: [{ id: 'j', name: 'Jam', start: at(2026, 11, 20, 18), hours: 48 }] };
    const now = new Date(2026, 10, 17, 10);
    const r = gamedevReminders(s, now);
    expect(r.find((x) => x.id === 'gamedev:plan')!.date).toEqual(new Date(2026, 10, 22, 18));
    expect(r.filter((x) => x.id.startsWith('jam:j')).length).toBe(3);
    // launch 2026-12-17: 'launch-discount'/'wishlist-goal'/'release-build' at -30 = 2026-11-17 09:00 (already past), 'release-date' -21 = 11-26
    expect(r.find((x) => x.id === 'launch:g:release-date')!.date).toEqual(new Date(2026, 10, 26, 9));
    expect(r.some((x) => x.id === 'launch:g:release-build')).toBe(false);
    expect(r.some((x) => x.id === 'launch:g:steam-direct')).toBe(false); // overdue, not re-nagged
    const planned = togglePick(s, { week: '2026-11-23', projectId: 'g', taskId: 't1' });
    expect(gamedevReminders(planned, now).some((x) => x.id === 'gamedev:plan')).toBe(false);
  });
});
