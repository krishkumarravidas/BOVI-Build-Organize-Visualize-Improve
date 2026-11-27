import { addDays, daysBetween, fromDateKey, toDateKey } from './dates';
import { weekStart } from './insights';
import type { GamedevCollection, Project, ProjectsState } from './projects';
import type { DateKey } from './types';

// =====================================================================================================
// Types
// =====================================================================================================

export type FeaturePriority = 'must' | 'should' | 'could' | 'cut';
export type FeatureSize = 'S' | 'M' | 'L';

export interface Feature {
  id: string;
  title: string;
  priority: FeaturePriority;
  size: FeatureSize;
  done: boolean;
  doneAt?: number;
}

/** A task picked for a week's plan. */
export interface WeekPick {
  week: DateKey;
  projectId: string;
  taskId: string;
}

export type BugSeverity = 'crash' | 'high' | 'medium' | 'low';

export interface Bug {
  id: string;
  projectId: string;
  title: string;
  severity: BugSeverity;
  steps?: string;
  status: 'open' | 'fixed';
  createdAt: number;
  fixedAt?: number;
  /** Screenshot copied into the app's documents folder. */
  image?: string;
}

export interface Playtest {
  id: string;
  projectId: string;
  date: DateKey;
  tester: string;
  build?: string;
  /** Where/what scared them (horror!). */
  scared?: string;
  confused?: string;
  bored?: string;
  notes?: string;
  /** 1–5. */
  fun?: number;
}

export interface Build {
  id: string;
  projectId: string;
  version: string;
  date: DateKey;
  notes: string;
  url?: string;
}

export interface LearningItem {
  id: string;
  title: string;
  url?: string;
  projectId?: string;
  status: 'todo' | 'doing' | 'done';
  /** How it was used ("applied in my game: AI perception"). */
  applied?: string;
  createdAt: DateKey;
  doneAt?: number;
}

export const ASSET_SOURCES = ['Fab', 'Marketplace', 'Quixel', 'Sketchfab', 'itch.io', 'Own', 'Other'] as const;
export type AssetSource = (typeof ASSET_SOURCES)[number];

export interface AssetItem {
  id: string;
  projectId: string;
  name: string;
  source: AssetSource;
  license?: string;
  /** Price paid (0 for free). */
  cost: number;
  status: 'unused' | 'used';
  url?: string;
  /** Author/creator, for the credits list. */
  author?: string;
}

export const REF_TAGS = ['mood', 'lighting', 'monster', 'level', 'ui', 'other'] as const;
export type RefTag = (typeof REF_TAGS)[number];

export interface RefImage {
  id: string;
  projectId: string;
  uri: string;
  caption?: string;
  tag: RefTag;
  createdAt: number;
}

export interface WishlistEntry {
  id: string;
  projectId: string;
  date: DateKey;
  wishlists: number;
  followers?: number;
}

export interface GameJam {
  id: string;
  name: string;
  /** Epoch ms when the theme is revealed / the jam starts. */
  start: number;
  hours: number;
  theme?: string;
  url?: string;
  notes?: string;
}

/** Sunday review notes for a week (Monday key). */
export interface WeekReview {
  id: string;
  week: DateKey;
  well?: string;
  change?: string;
}

/** Launch checklist progress, keyed by LAUNCH_ITEMS key. `date` overrides the suggested date. */
export type LaunchState = Record<string, { done: boolean; doneAt?: number; date?: DateKey }>;

// =====================================================================================================
// Generic collection helpers
// =====================================================================================================

type ItemOf<K extends GamedevCollection> = NonNullable<ProjectsState[K]>[number];

export function upsertItem<K extends Exclude<GamedevCollection, 'weekPlan'>>(state: ProjectsState, key: K, item: ItemOf<K>): ProjectsState {
  const list = (state[key] ?? []) as { id: string }[];
  const it = item as { id: string };
  const next = list.some((x) => x.id === it.id) ? list.map((x) => (x.id === it.id ? it : x)) : [...list, it];
  return { ...state, [key]: next };
}

export function removeItem<K extends Exclude<GamedevCollection, 'weekPlan'>>(state: ProjectsState, key: K, id: string): ProjectsState {
  return { ...state, [key]: ((state[key] ?? []) as { id: string }[]).filter((x) => x.id !== id) };
}

export function forProject<T extends { projectId?: string }>(list: readonly T[] | undefined, projectId: string): T[] {
  return (list ?? []).filter((x) => x.projectId === projectId);
}

/** Removes a project's workspace data (bugs, builds, refs...) along with it. */
export function deleteProjectData(state: ProjectsState, projectId: string): ProjectsState {
  const out: ProjectsState = { ...state };
  for (const k of ['bugs', 'playtests', 'builds', 'assets', 'refs', 'wishlists', 'weekPlan'] as const) {
    if (state[k]) (out as unknown as Record<string, unknown[]>)[k] = (state[k] as { projectId: string }[]).filter((x) => x.projectId !== projectId);
  }
  if (state.learning) out.learning = state.learning.map((l) => (l.projectId === projectId ? { ...l, projectId: undefined } : l));
  // Courses outlive the project: just unlink them.
  if (state.courses) out.courses = state.courses.map((c) => (c.projectId === projectId ? { ...c, projectId: undefined } : c));
  return out;
}

// =====================================================================================================
// 1. Scope: features with cut lines
// =====================================================================================================

export const PRIORITY_ORDER: FeaturePriority[] = ['must', 'should', 'could', 'cut'];
export const PRIORITY_LABEL: Record<FeaturePriority, string> = { must: 'Must', should: 'Should', could: 'Could', cut: 'Cut' };
/** Rough solo-dev hours per size. */
export const FEATURE_HOURS: Record<FeatureSize, number> = { S: 4, M: 12, L: 30 };
/** Used when there's no focus history yet. */
export const DEFAULT_WEEKLY_HOURS = 6;

export function setFeatures(state: ProjectsState, projectId: string, fn: (features: Feature[]) => Feature[]): ProjectsState {
  return { ...state, projects: state.projects.map((p) => (p.id === projectId ? { ...p, features: fn(p.features ?? []) } : p)) };
}

/** Average focus hours per week on a project over the last `weeks` weeks (0 when none). */
export function weeklyFocusHours(state: ProjectsState, projectId: string, now: number, weeks = 4): number {
  const from = now - weeks * 7 * 86_400_000;
  const minutes = state.focus.filter((s) => s.projectId === projectId && s.start >= from && s.start <= now).reduce((a, s) => a + s.minutes, 0);
  return minutes / 60 / weeks;
}

export interface ScopeCheck {
  /** Open hours per priority. */
  hours: Record<FeaturePriority, number>;
  /** Hours available before the deadline at the current pace, or null without a deadline. */
  capacity: number | null;
  weeklyHours: number;
  /** True when weeklyHours is the default, not measured. */
  assumedPace: boolean;
  weeksLeft: number | null;
  /** Must + Should + Could fit. */
  fits: boolean | null;
  mustFits: boolean | null;
  /** Open Could, then Should, features to cut (largest first) until the rest fits. */
  suggestCuts: Feature[];
}

export function scopeCheck(features: readonly Feature[], deadline: DateKey | undefined, measuredWeeklyHours: number, today: DateKey): ScopeCheck {
  const hours: Record<FeaturePriority, number> = { must: 0, should: 0, could: 0, cut: 0 };
  for (const f of features) if (!f.done) hours[f.priority] += FEATURE_HOURS[f.size];
  const assumedPace = measuredWeeklyHours <= 0;
  const weeklyHours = assumedPace ? DEFAULT_WEEKLY_HOURS : measuredWeeklyHours;
  if (!deadline) return { hours, capacity: null, weeklyHours, assumedPace, weeksLeft: null, fits: null, mustFits: null, suggestCuts: [] };
  const weeksLeft = Math.max(0, daysBetween(today, deadline)) / 7;
  const capacity = weeksLeft * weeklyHours;
  let needed = hours.must + hours.should + hours.could;
  const suggestCuts: Feature[] = [];
  for (const pr of ['could', 'should'] as const) {
    const open = features.filter((f) => !f.done && f.priority === pr).sort((a, b) => FEATURE_HOURS[b.size] - FEATURE_HOURS[a.size]);
    for (const f of open) {
      if (needed <= capacity) break;
      suggestCuts.push(f);
      needed -= FEATURE_HOURS[f.size];
    }
  }
  return {
    hours,
    capacity,
    weeklyHours,
    assumedPace,
    weeksLeft,
    fits: hours.must + hours.should + hours.could <= capacity,
    mustFits: hours.must <= capacity,
    suggestCuts,
  };
}

// =====================================================================================================
// 2. Vertical slice template
// =====================================================================================================

export const VERTICAL_SLICE: string[] = [
  'Vertical slice: core loop playable start to finish',
  'Vertical slice: one complete level / area',
  'Vertical slice: one enemy with working AI',
  'Vertical slice: one scripted key moment (scare / set piece)',
  'Vertical slice: main menu, pause, settings',
  'Vertical slice: final-quality art, audio and lighting in one area',
  'Vertical slice: packaged build runs on another PC',
];

// =====================================================================================================
// 3. Weekly plan
// =====================================================================================================

export function thisWeek(today: DateKey): DateKey {
  return weekStart(today);
}

export function togglePick(state: ProjectsState, pick: WeekPick): ProjectsState {
  const list = state.weekPlan ?? [];
  const same = (p: WeekPick) => p.week === pick.week && p.projectId === pick.projectId && p.taskId === pick.taskId;
  return { ...state, weekPlan: list.some(same) ? list.filter((p) => !same(p)) : [...list, pick] };
}

export interface PlannedTask {
  pick: WeekPick;
  project: Project;
  task: Project['tasks'][number];
}

/** This week's picks that still exist, with their project and task. */
export function weekTasks(state: ProjectsState, week: DateKey): PlannedTask[] {
  const out: PlannedTask[] = [];
  for (const pick of state.weekPlan ?? []) {
    if (pick.week !== week) continue;
    const project = state.projects.find((p) => p.id === pick.projectId);
    const task = project?.tasks.find((t) => t.id === pick.taskId);
    if (project && task) out.push({ pick, project, task });
  }
  return out;
}

/** Drops picks older than ~8 weeks so the list doesn't grow forever. */
export function prunePlan(state: ProjectsState, today: DateKey): ProjectsState {
  if (!state.weekPlan) return state;
  const cutoff = addDays(thisWeek(today), -56);
  const kept = state.weekPlan.filter((p) => p.week >= cutoff);
  return kept.length === state.weekPlan.length ? state : { ...state, weekPlan: kept };
}

/** Next Sunday 18:00 (today if it's Sunday before 18:00): "plan your week" reminder. */
export function nextPlanReminder(now: Date): Date {
  const d = new Date(now);
  d.setHours(18, 0, 0, 0);
  const add = (7 - d.getDay()) % 7;
  d.setDate(d.getDate() + add);
  if (d <= now) d.setDate(d.getDate() + 7);
  return d;
}

// =====================================================================================================
// 4. Velocity and forecast
// =====================================================================================================

export interface WeekStats {
  week: DateKey;
  /** Tasks, features and milestones ticked, plus bugs fixed. */
  done: number;
  focusMin: number;
}

/** Timestamps of everything finished on a project (or all projects with `projectId` undefined). */
export function doneStamps(state: ProjectsState, projectId?: string): number[] {
  const projects = projectId ? state.projects.filter((p) => p.id === projectId) : state.projects;
  const out: number[] = [];
  for (const p of projects) {
    for (const t of p.tasks) if (t.done && t.doneAt) out.push(t.doneAt);
    for (const m of p.milestones) if (m.done && m.doneAt) out.push(m.doneAt);
    for (const f of p.features ?? []) if (f.done && f.doneAt) out.push(f.doneAt);
  }
  for (const b of state.bugs ?? []) if (b.status === 'fixed' && b.fixedAt && (!projectId || b.projectId === projectId)) out.push(b.fixedAt);
  return out;
}

export function weeklyStats(state: ProjectsState, projectId: string | undefined, today: DateKey, weeks = 8): WeekStats[] {
  const first = addDays(thisWeek(today), -(weeks - 1) * 7);
  const stats = Array.from({ length: weeks }, (_, i) => ({ week: addDays(first, i * 7), done: 0, focusMin: 0 }));
  const index = (ms: number) => {
    const w = thisWeek(toDateKey(new Date(ms)));
    return stats.findIndex((s) => s.week === w);
  };
  for (const t of doneStamps(state, projectId)) {
    const i = index(t);
    if (i >= 0) stats[i].done++;
  }
  for (const s of state.focus) {
    if (s.subjectId || (projectId && s.projectId !== projectId)) continue;
    const i = index(s.start);
    if (i >= 0) stats[i].focusMin += s.minutes;
  }
  return stats;
}

/**
 * When the remaining items will be done at the recent pace (average of the last 4 *completed* weeks
 * with any activity window), or null when there's no pace yet.
 */
export function forecast(remaining: number, stats: readonly WeekStats[], today: DateKey): { perWeek: number; date: DateKey | null } {
  const past = stats.slice(-5, -1); // last 4 full weeks, excluding the current one
  const perWeek = past.length ? past.reduce((a, s) => a + s.done, 0) / past.length : 0;
  if (remaining <= 0) return { perWeek, date: today };
  if (perWeek <= 0) return { perWeek, date: null };
  return { perWeek, date: addDays(today, Math.ceil((remaining / perWeek) * 7)) };
}

// =====================================================================================================
// 8. Builds and changelog
// =====================================================================================================

/** "0.3.1" -> "0.3.2"; anything else gets "-2" style bump; empty -> "0.1.0". */
export function nextVersion(last?: string): string {
  if (!last) return '0.1.0';
  const m = /^(.*?)(\d+)(\D*)$/.exec(last.trim());
  if (!m) return `${last}-2`;
  return `${m[1]}${Number(m[2]) + 1}${m[3]}`;
}

/** Markdown-ish changelog of what was finished in (sinceMs, untilMs]. */
export function changelog(state: ProjectsState, projectId: string, sinceMs: number, untilMs: number): string {
  const p = state.projects.find((x) => x.id === projectId);
  if (!p) return '';
  const inRange = (t?: number) => !!t && t > sinceMs && t <= untilMs;
  const lines: string[] = [];
  const ms = p.milestones.filter((m) => m.done && inRange(m.doneAt));
  const fs = (p.features ?? []).filter((f) => f.done && inRange(f.doneAt));
  const ts = p.tasks.filter((t) => t.done && inRange(t.doneAt));
  const bs = (state.bugs ?? []).filter((b) => b.projectId === projectId && b.status === 'fixed' && inRange(b.fixedAt));
  if (ms.length) lines.push(...ms.map((m) => `★ ${m.title}`));
  if (fs.length) lines.push(...fs.map((f) => `+ ${f.title}`));
  if (ts.length) lines.push(...ts.map((t) => `• ${t.title}`));
  if (bs.length) lines.push(...bs.map((b) => `Fixed: ${b.title}`));
  return lines.join('\n');
}

export function lastBuild(state: ProjectsState, projectId: string): Build | undefined {
  return forProject(state.builds, projectId).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))[0];
}

// =====================================================================================================
// 6/7. Bugs and playtests
// =====================================================================================================

export const SEVERITY_ORDER: BugSeverity[] = ['crash', 'high', 'medium', 'low'];
export const SEVERITY_LABEL: Record<BugSeverity, string> = { crash: 'Crash', high: 'High', medium: 'Medium', low: 'Low' };

export function sortedBugs(bugs: readonly Bug[]): Bug[] {
  return [...bugs].sort(
    (a, b) =>
      (a.status === b.status ? 0 : a.status === 'open' ? -1 : 1) ||
      SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) ||
      b.createdAt - a.createdAt,
  );
}

export function setBugStatus(state: ProjectsState, id: string, status: Bug['status'], now: number): ProjectsState {
  return {
    ...state,
    bugs: (state.bugs ?? []).map((b) => {
      if (b.id !== id) return b;
      const { fixedAt: _f, ...rest } = b;
      void _f;
      return status === 'fixed' ? { ...rest, status, fixedAt: now } : { ...rest, status };
    }),
  };
}

export function playtestSummary(tests: readonly Playtest[]): { count: number; avgFun: number | null; testers: number } {
  const rated = tests.filter((t) => typeof t.fun === 'number');
  return {
    count: tests.length,
    avgFun: rated.length ? rated.reduce((a, t) => a + (t.fun ?? 0), 0) / rated.length : null,
    testers: new Set(tests.map((t) => t.tester.trim().toLowerCase()).filter(Boolean)).size,
  };
}

// =====================================================================================================
// 10. Assets
// =====================================================================================================

export function assetTotals(assets: readonly AssetItem[]): { spent: number; unusedSpent: number; unused: number; count: number } {
  return {
    count: assets.length,
    spent: assets.reduce((a, x) => a + (x.cost || 0), 0),
    unused: assets.filter((x) => x.status === 'unused').length,
    unusedSpent: assets.filter((x) => x.status === 'unused').reduce((a, x) => a + (x.cost || 0), 0),
  };
}

/** Plain-text credits for the assets actually used. */
export function creditsText(projectName: string, assets: readonly AssetItem[]): string {
  const used = assets.filter((a) => a.status === 'used');
  if (!used.length) return `${projectName}: no third-party assets marked as used yet.`;
  const lines = used.map((a) => `- ${a.name}${a.author ? ` by ${a.author}` : ''} (${a.source}${a.license ? `, ${a.license}` : ''})${a.url ? ` ${a.url}` : ''}`);
  return `${projectName} — third-party assets\n${lines.join('\n')}`;
}

// =====================================================================================================
// 12/13. Steam launch checklist and wishlists
// =====================================================================================================

export interface LaunchItemDef {
  key: string;
  title: string;
  /** Days relative to launch (negative = before). Typical timing; each item's date can be changed. */
  offset: number;
  hint?: string;
}

export const LAUNCH_ITEMS: LaunchItemDef[] = [
  { key: 'steam-direct', title: 'Pay the Steam Direct fee and set up Steamworks', offset: -300, hint: 'Takes days to verify identity, bank and tax info.' },
  { key: 'capsules', title: 'Capsule art', offset: -240, hint: 'Header 920×430, small 462×174, main 1232×706, vertical 748×896, library 600×900, hero 3840×1240, logo 1280×720.' },
  { key: 'screenshots', title: 'Screenshots (5+) and short description', offset: -230, hint: 'Gameplay, not menus. The first 4 show on hover.' },
  { key: 'content-survey', title: 'Content survey / age ratings', offset: -225 },
  { key: 'trailer', title: 'Trailer', offset: -220, hint: 'Show gameplay in the first 5 seconds.' },
  { key: 'coming-soon', title: 'Coming Soon page live', offset: -210, hint: 'Steam reviews the page first; allow a week. Wishlists start here.' },
  { key: 'press-kit', title: 'Press kit page', offset: -180 },
  { key: 'demo', title: 'Demo build', offset: -150 },
  { key: 'next-fest-register', title: 'Register for Steam Next Fest', offset: -120, hint: 'Check the dates and deadline in Steamworks; set the real date here.' },
  { key: 'next-fest', title: 'Steam Next Fest', offset: -90, hint: 'Stream your demo; the biggest wishlist spike for most indies.' },
  { key: 'creator-list', title: 'Press and creator list (e.g. horror YouTubers/streamers)', offset: -60 },
  { key: 'achievements', title: 'Achievements and cloud saves (optional)', offset: -45 },
  { key: 'pricing', title: 'Price and regional pricing', offset: -45 },
  { key: 'wishlist-goal', title: 'Check wishlists against your goal', offset: -30 },
  { key: 'launch-discount', title: 'Decide the launch discount', offset: -30 },
  { key: 'release-build', title: 'Upload the release build and pass Steam\'s build review', offset: -30 },
  { key: 'release-date', title: 'Set the release date and press the button in Steamworks', offset: -21 },
  { key: 'keys', title: 'Send keys to creators and press', offset: -14 },
  { key: 'launch-post', title: 'Launch-day post, trailer and devlog', offset: 0 },
  { key: 'patch', title: 'First patch from launch feedback', offset: 7 },
];

export interface LaunchItem extends LaunchItemDef {
  date: DateKey | null;
  done: boolean;
  /** Date passed and not done. */
  late: boolean;
}

export function launchItems(project: Project, today: DateKey): LaunchItem[] {
  const st = project.launch ?? {};
  return LAUNCH_ITEMS.map((d) => {
    const s = st[d.key];
    const date = s?.date ?? (project.launchDate ? addDays(project.launchDate, d.offset) : null);
    const done = !!s?.done;
    return { ...d, date, done, late: !done && !!date && date < today };
  }).sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'));
}

export function setLaunchItem(state: ProjectsState, projectId: string, key: string, patch: { done?: boolean; date?: DateKey | null }, now: number): ProjectsState {
  return {
    ...state,
    projects: state.projects.map((p) => {
      if (p.id !== projectId) return p;
      const cur = p.launch?.[key] ?? { done: false };
      const next: LaunchState[string] = { done: patch.done ?? cur.done };
      if (next.done) next.doneAt = patch.done === true && !cur.done ? now : cur.doneAt;
      const date = patch.date === undefined ? cur.date : patch.date ?? undefined;
      if (date) next.date = date;
      return { ...p, launch: { ...(p.launch ?? {}), [key]: next } };
    }),
  };
}

export const DEFAULT_WISHLIST_GOAL = 7000;

export function wishlistSeries(entries: readonly WishlistEntry[]): WishlistEntry[] {
  return [...entries].sort((a, b) => a.date.localeCompare(b.date));
}

/** Wishlists gained per week over the series (last two entries), or null. */
export function wishlistRate(entries: readonly WishlistEntry[]): number | null {
  const s = wishlistSeries(entries);
  if (s.length < 2) return null;
  const a = s[s.length - 2];
  const b = s[s.length - 1];
  const days = daysBetween(a.date, b.date);
  return days > 0 ? ((b.wishlists - a.wishlists) / days) * 7 : null;
}

// =====================================================================================================
// 15. Game jams
// =====================================================================================================

export const JAM_PHASES: { title: string; share: number; hint: string }[] = [
  { title: 'Theme, brainstorm and scope', share: 0.05, hint: 'Pick the smallest idea that fits the theme. Write the one-sentence pitch.' },
  { title: 'Core mechanic prototype', share: 0.25, hint: 'Grey boxes only. Is it fun yet?' },
  { title: 'Rest', share: 0.15, hint: 'Sleep. Tired-you writes bugs.' },
  { title: 'Content: one level, one goal', share: 0.25, hint: 'Build exactly enough for 5 minutes of play.' },
  { title: 'Polish: audio, juice, menus', share: 0.15, hint: 'Sound and feedback beat new features.' },
  { title: 'Build, test, page and submit', share: 0.1, hint: 'Test the packaged build on another machine.' },
  { title: 'Buffer', share: 0.05, hint: 'Uploads fail. Submit early.' },
];

export const JAM_SCOPE_LIMITS = [
  'One core mechanic',
  'One level, 5–10 minutes of play',
  'Start screen and end screen only',
  'Placeholder art is fine; sound is not optional',
  'No save system, no settings menu beyond volume',
  'Cut anything not done by the halfway mark',
];

export interface JamPhase {
  title: string;
  hint: string;
  start: number;
  end: number;
}

export function jamPhases(jam: GameJam): JamPhase[] {
  const total = jam.hours * 3_600_000;
  let t = jam.start;
  return JAM_PHASES.map((p) => {
    const start = t;
    t += p.share * total;
    return { title: p.title, hint: p.hint, start: Math.round(start), end: Math.round(t) };
  });
}

export type JamStatus = { state: 'upcoming'; msToStart: number } | { state: 'running'; msLeft: number; phase: JamPhase } | { state: 'ended' };

export function jamStatus(jam: GameJam, now: number): JamStatus {
  const end = jam.start + jam.hours * 3_600_000;
  if (now < jam.start) return { state: 'upcoming', msToStart: jam.start - now };
  if (now >= end) return { state: 'ended' };
  const phases = jamPhases(jam);
  return { state: 'running', msLeft: end - now, phase: phases.find((p) => now < p.end) ?? phases[phases.length - 1] };
}

/** "3d 4h", "5h 20m", "12m". */
export function formatCountdown(ms: number): string {
  const min = Math.max(0, Math.floor(ms / 60_000));
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  if (d > 0) return h ? `${d}d ${h}h` : `${d}d`;
  if (h > 0) return m ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

export function jamHeadline(jam: GameJam, now: number): string {
  const st = jamStatus(jam, now);
  if (st.state === 'upcoming') return `${jam.name} starts in ${formatCountdown(st.msToStart)}`;
  if (st.state === 'running') return `${jam.name}: ${formatCountdown(st.msLeft)} left · ${st.phase.title}`;
  return `${jam.name} has ended`;
}

/** The jam to show on the Projects tab: running, else the next one within 14 days. */
export function featuredJam(jams: readonly GameJam[] | undefined, now: number): GameJam | undefined {
  const list = jams ?? [];
  return (
    list.find((j) => jamStatus(j, now).state === 'running') ??
    list.filter((j) => j.start > now && j.start - now < 14 * 86_400_000).sort((a, b) => a.start - b.start)[0]
  );
}

export function jamReminders(jams: readonly GameJam[] | undefined, now: Date): { id: string; title: string; body: string; date: Date }[] {
  const out: { id: string; title: string; body: string; date: Date }[] = [];
  for (const j of jams ?? []) {
    const end = j.start + j.hours * 3_600_000;
    const candidates = [
      { id: `jam:${j.id}:start`, title: `${j.name} starts now`, body: 'Theme is out. Brainstorm, then pick the smallest idea.', at: j.start },
      { id: `jam:${j.id}:scope`, title: `${j.name}: scope check`, body: 'Is the core loop playable? Cut anything that isn’t started.', at: j.start + (end - j.start) * 0.3 },
      { id: `jam:${j.id}:submit`, title: `${j.name}: 2 hours left`, body: 'Package, test the build and submit now.', at: end - 2 * 3_600_000 },
    ];
    for (const c of candidates) if (c.at > now.getTime()) out.push({ id: c.id, title: c.title, body: c.body, date: new Date(c.at) });
  }
  return out;
}

// =====================================================================================================
// Calendar: game-dev things due on a day
// =====================================================================================================

export type DueItem =
  | { kind: 'milestone'; key: string; projectId: string; id: string; title: string; project: string; done: boolean }
  | { kind: 'launch'; key: string; projectId: string; id: string; title: string; project: string; done: boolean }
  | { kind: 'jam'; key: string; id: string; title: string; start: number };

/** Milestones due, Steam launch steps scheduled and jams starting on `day` (for the calendar's to-do list). */
export function gamedevDueOn(state: ProjectsState, day: DateKey): DueItem[] {
  const out: DueItem[] = [];
  for (const p of state.projects) {
    if (p.status === 'done' || p.status === 'parked') continue;
    for (const m of p.milestones) if (m.due === day) out.push({ kind: 'milestone', key: `m:${p.id}:${m.id}`, projectId: p.id, id: m.id, title: m.title, project: p.name, done: m.done });
    if (p.launchDate || p.launch) {
      for (const it of launchItems(p, day)) if (it.date === day) out.push({ kind: 'launch', key: `l:${p.id}:${it.key}`, projectId: p.id, id: it.key, title: it.title, project: p.name, done: it.done });
    }
  }
  for (const j of state.jams ?? []) if (toDateKey(new Date(j.start)) === day) out.push({ kind: 'jam', key: `j:${j.id}`, id: j.id, title: j.name, start: j.start });
  return out;
}

// =====================================================================================================
// 16. Activity: streaks and heatmap
// =====================================================================================================

/** Count of game-dev actions per day: focus sessions, devlog entries, things finished, builds, playtests, commits. */
export function activityByDay(state: ProjectsState, projectId?: string, commitDays: readonly DateKey[] = []): Map<DateKey, number> {
  const m = new Map<DateKey, number>();
  const bump = (d: DateKey) => m.set(d, (m.get(d) ?? 0) + 1);
  const projects = projectId ? state.projects.filter((p) => p.id === projectId) : state.projects;
  for (const s of state.focus) if (!s.subjectId && (!projectId || s.projectId === projectId)) bump(toDateKey(new Date(s.start)));
  for (const p of projects) for (const e of p.log) bump(e.date);
  for (const t of doneStamps(state, projectId)) bump(toDateKey(new Date(t)));
  for (const b of state.builds ?? []) if (!projectId || b.projectId === projectId) bump(b.date);
  for (const t of state.playtests ?? []) if (!projectId || t.projectId === projectId) bump(t.date);
  for (const d of commitDays) bump(d);
  return m;
}

/** Consecutive active days ending today (or yesterday, so the streak survives until you work today). */
export function streak(days: ReadonlyMap<DateKey, number>, today: DateKey): number {
  let d = days.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

/** Days since the last activity, or null if never. */
export function daysSinceActive(days: ReadonlyMap<DateKey, number>, today: DateKey): number | null {
  let latest: DateKey | null = null;
  for (const d of days.keys()) if (d <= today && (!latest || d > latest)) latest = d;
  return latest ? daysBetween(latest, today) : null;
}

/** Columns of 7 days (Mon–Sun) for the last `weeks` weeks, ending with this week. */
export function heatmapWeeks(today: DateKey, weeks = 17): DateKey[][] {
  const first = addDays(thisWeek(today), -(weeks - 1) * 7);
  return Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(first, w * 7 + d)));
}

export function activeDaysIn(days: ReadonlyMap<DateKey, number>, from: DateKey, to: DateKey): number {
  let n = 0;
  for (const d of days.keys()) if (d >= from && d <= to) n++;
  return n;
}

/** Friendly nudge for a project left alone a while, or null. */
export function nudgeFor(projectName: string, idleDays: number | null): string | null {
  if (idleDays === null || idleDays < 3) return null;
  return idleDays >= 14 ? `${idleDays} days since you touched ${projectName}. Even 15 minutes today keeps it alive.` : `${idleDays} days without touching ${projectName}.`;
}

export function dateLabel(key: DateKey): string {
  return fromDateKey(key).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
