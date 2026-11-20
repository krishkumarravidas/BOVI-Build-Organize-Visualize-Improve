import { seedProjects } from '@/lib/__fixtures__/demo';

import { addTask, deleteProject, groupProjects, migrateProjects, removeTask, taskProgress, toggleTask, upsertProject } from './projects';

describe('projects', () => {
  it('groups by status with Active first and empty groups dropped', () => {
    const groups = groupProjects(seedProjects().projects);
    expect(groups[0]).toMatchObject({ status: 'active' });
    expect(groups[0].projects.map((p) => p.name)).toEqual(['Shadow Hall']);
    expect(groups.map((g) => g.status)).not.toContain('done');
  });

  it('sorts dated projects first within a group', () => {
    const planned = groupProjects(seedProjects().projects).find((g) => g.status === 'planned')!;
    expect(planned.projects.at(-1)?.name).toBe('Animation test'); // no date → last
  });

  it('adds, edits and deletes projects', () => {
    let s = seedProjects();
    s = upsertProject(s, { id: 'new', name: '  Jam game ', status: 'concept', tasks: [] });
    expect(s.projects.find((p) => p.id === 'new')?.name).toBe('Jam game');
    s = upsertProject(s, { id: 'new', name: 'Jam game', status: 'active', tasks: [] });
    expect(s.projects.filter((p) => p.id === 'new')).toHaveLength(1);
    expect(() => upsertProject(s, { id: 'x', name: ' ', status: 'active', tasks: [] })).toThrow();
    s = deleteProject(s, 'new');
    expect(s.projects.some((p) => p.id === 'new')).toBe(false);
  });

  it('manages tasks', () => {
    let s = seedProjects();
    s = addTask(s, 'board-ghost', 'Board rules draft', 't1');
    s = addTask(s, 'board-ghost', '   ', 't2'); // ignored
    s = toggleTask(s, 'board-ghost', 't1');
    const p = s.projects.find((x) => x.id === 'board-ghost')!;
    expect(taskProgress(p)).toEqual({ done: 1, total: 1 });
    s = removeTask(s, 'board-ghost', 't1');
    expect(s.projects.find((x) => x.id === 'board-ghost')!.tasks).toEqual([]);
  });

  it('migrates v1 and fills missing task arrays', () => {
    expect(migrateProjects({ version: 1, projects: [{ id: 'a', name: 'A', status: 'active' }] })?.projects[0].tasks).toEqual([]);
    expect(migrateProjects({ version: 2 })).toBeNull();
  });
});

describe('milestones, devlog, ideas, focus', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const P = require('./projects') as typeof import('./projects');

  it('keeps roadmap order and finds the next open milestone', () => {
    let s = seedProjects();
    s = P.addMilestone(s, 'board-ghost', { title: 'Rules prototype', due: '2026-12-10' }, 'm1');
    s = P.addMilestone(s, 'board-ghost', { title: 'Paper playtest', due: '2026-12-01' }, 'm2');
    s = P.addMilestone(s, 'board-ghost', { title: '  ' }, 'm3');
    const b = () => s.projects.find((p) => p.id === 'board-ghost')!;
    expect(P.sortedMilestones(b()).map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(P.nextMilestone(b())?.id).toBe('m1');
    s = P.toggleMilestone(s, 'board-ghost', 'm1');
    expect(P.nextMilestone(b())?.id).toBe('m2');
    s = P.removeMilestone(s, 'board-ghost', 'm2');
    expect(P.nextMilestone(b())).toBeUndefined();
  });

  it('builds a markdown devlog for a date range', () => {
    let s = seedProjects();
    s = P.addLogEntry(s, 'shadow-hall', '2026-11-16', 'Wrote act 2 beats\nBlocked out level 2', 'l1');
    s = P.addLogEntry(s, 'shadow-hall', '2026-11-14', 'Old entry', 'l0');
    s = P.addLogEntry(s, 'shadow-hall', '2026-11-17', 'Enemy patrol AI', 'l2');
    s = P.toggleMilestone(s, 'shadow-hall', 'm-k-acts');
    const md = P.devlogMarkdown(s.projects.find((p) => p.id === 'shadow-hall')!, '2026-11-15', '2026-11-21');
    expect(md).toBe(
      [
        '# Shadow Hall devlog (2026-11-15 to 2026-11-21)',
        '',
        '## 2026-11-16',
        '- Wrote act 2 beats',
        '- Blocked out level 2',
        '',
        '## 2026-11-17',
        '- Enemy patrol AI',
        '',
        '**Milestones done:** Full story outline (all acts)',
        '**Next milestone:** Vertical slice',
      ].join('\n'),
    );
    expect(P.sortedLog(s.projects.find((p) => p.id === 'shadow-hall')!)[0].id).toBe('l2');
  });

  it('keeps milestones and log when the project form saves', () => {
    let s = P.addLogEntry(seedProjects(), 'shadow-hall', '2026-11-16', 'x', 'l1');
    const k = s.projects.find((p) => p.id === 'shadow-hall')!;
    s = P.upsertProject(s, { id: k.id, name: k.name, status: k.status, tasks: k.tasks });
    expect(s.projects.find((p) => p.id === 'shadow-hall')!.log).toHaveLength(1);
    expect(s.projects.find((p) => p.id === 'shadow-hall')!.milestones).toHaveLength(3);
  });

  it('captures ideas and promotes them to concept projects', () => {
    let s = P.addIdea(seedProjects(), 'Haunted tram sim\nTram driver at night in Kolkata', '2026-11-15', 'i1');
    s = P.addIdea(s, '   ', '2026-11-15', 'i2');
    expect(s.ideas).toHaveLength(1);
    s = P.promoteIdea(s, 'i1', 'p-tram');
    expect(s.ideas).toEqual([]);
    expect(s.projects.find((p) => p.id === 'p-tram')).toMatchObject({
      name: 'Haunted tram sim',
      status: 'concept',
      notes: 'Tram driver at night in Kolkata\nFrom the ideas inbox (2026-11-15).',
    });
  });

  it('runs a focus session and logs actual minutes', () => {
    const t0 = new Date(2026, 10, 16, 18, 0).getTime();
    let s = P.startFocus(seedProjects(), 'shadow-hall', 25, t0);
    expect(P.focusRemainingMs(s.activeFocus!, t0 + 5 * 60_000)).toBe(20 * 60_000);
    s = P.stopFocus(s, t0 + 18.4 * 60_000, 'f1');
    expect(s.activeFocus).toBeNull();
    expect(s.focus).toEqual([{ id: 'f1', projectId: 'shadow-hall', start: t0, minutes: 18 }]);
    // Overrun is capped at the plan; 40 s counts as 1 min; under 30 s is discarded.
    s = P.stopFocus(P.startFocus(s, undefined, 25, t0 + 3_600_000), t0 + 3_600_000 + 40 * 60_000, 'f2');
    s = P.stopFocus(P.startFocus(s, 'shadow-hall', 25, t0 + 7_200_000), t0 + 7_200_000 + 40_000, 'f3');
    s = P.stopFocus(P.startFocus(s, 'shadow-hall', 25, t0 + 9_000_000), t0 + 9_000_000 + 20_000, 'f4');
    const mins = P.focusMinutesByProject(s, t0 - 1, t0 + 86_400_000);
    expect([...mins.entries()]).toEqual([['shadow-hall', 19], ['', 25]]);
  });

  it('auto-logs a finished session in full, even if noticed much later', () => {
    const t0 = new Date(2026, 10, 16, 18, 0).getTime();
    const running = P.startFocus(seedProjects(), 'shadow-hall', 25, t0);
    expect(P.completeFocusIfDue(running, t0 + 10 * 60_000, 'x')).toBe(running); // still running
    const done = P.completeFocusIfDue(running, t0 + 5 * 3_600_000, 'x');
    expect(done.activeFocus).toBeNull();
    expect(done.focus).toEqual([{ id: 'x', projectId: 'shadow-hall', start: t0, minutes: 25 }]);
  });

  it('migrates old project data with defaults', () => {
    const m = P.migrateProjects({ version: 1, projects: [{ id: 'a', name: 'A', status: 'active', tasks: [] }] })!;
    expect(m).toMatchObject({ ideas: [], focus: [], activeFocus: null });
    expect(m.projects[0]).toMatchObject({ milestones: [], log: [] });
  });
});
