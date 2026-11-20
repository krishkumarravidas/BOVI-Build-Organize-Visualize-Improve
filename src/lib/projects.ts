import type { DateKey } from './types';
import type { AssetItem, Bug, Build, Feature, GameJam, LaunchState, LearningItem, Playtest, RefImage, WeekPick, WeekReview, WishlistEntry } from './gamedev';
import { sanitizeLinks, type ResourceLink } from './links';

export type ProjectStatus = 'active' | 'long-term' | 'planned' | 'concept' | 'paused' | 'parked' | 'decide' | 'done';

export const STATUS_ORDER: ProjectStatus[] = ['active', 'long-term', 'planned', 'concept', 'paused', 'decide', 'parked', 'done'];

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  active: 'Active',
  'long-term': 'Long-term',
  planned: 'Planned',
  concept: 'Concept',
  paused: 'Paused',
  parked: 'Parked',
  decide: 'To decide',
  done: 'Done',
};

export interface ProjectTask {
  id: string;
  title: string;
  done: boolean;
  /** Epoch ms when ticked (for velocity and streaks). */
  doneAt?: number;
}

export interface Milestone {
  id: string;
  title: string;
  due?: DateKey;
  done: boolean;
  doneAt?: number;
}

/** A devlog / journal entry. */
export interface LogEntry {
  id: string;
  date: DateKey;
  text: string;
}

export interface Idea {
  id: string;
  text: string;
  createdAt: DateKey;
}

export interface FocusSession {
  id: string;
  projectId?: string;
  /** Epoch ms. */
  start: number;
  minutes: number;
  /** What the session was for / what happened ("plan → outcome"). */
  note?: string;
  /** Set for study sessions (college); these never count as game-dev time. */
  subjectId?: string;
  /** Study session already used to tick off a planned revision session. */
  counted?: boolean;
}

export interface ActiveFocus {
  projectId?: string;
  startedAt: number;
  minutes: number;
  /** "What will you do?" typed when starting. */
  intent?: string;
  /** Study session for this subject (instead of a project). */
  subjectId?: string;
}

export interface Project {
  id: string;
  name: string;
  status: ProjectStatus;
  /** One-line description, e.g. platform/genre. */
  summary?: string;
  nextStep?: string;
  /** Optional date tied to the next step ("start after", "talk on"...). */
  date?: DateKey;
  notes?: string;
  tasks: ProjectTask[];
  milestones: Milestone[];
  log: LogEntry[];
  /** GitHub repo, Drive folder, design docs, store page... */
  links?: ResourceLink[];
  /** Scope list with Must/Should/Could/Cut priorities. */
  features?: Feature[];
  /** Target date for the current scope (vertical slice, demo, launch...). */
  deadline?: DateKey;
  /** Planned release date; the Steam launch checklist is scheduled back from it. */
  launchDate?: DateKey;
  launch?: LaunchState;
  wishlistGoal?: number;
  /** Which of the project's links is its GitHub repo for the commits view (default: the first GitHub link). */
  repoLinkId?: string;
}

export interface ProjectsState {
  version: 1;
  projects: Project[];
  ideas: Idea[];
  focus: FocusSession[];
  activeFocus: ActiveFocus | null;
  weekPlan?: WeekPick[];
  bugs?: Bug[];
  playtests?: Playtest[];
  builds?: Build[];
  learning?: LearningItem[];
  assets?: AssetItem[];
  refs?: RefImage[];
  wishlists?: WishlistEntry[];
  jams?: GameJam[];
  reviews?: WeekReview[];
}

export const GAMEDEV_COLLECTIONS = ['weekPlan', 'bugs', 'playtests', 'builds', 'learning', 'assets', 'refs', 'wishlists', 'jams', 'reviews'] as const;
export type GamedevCollection = (typeof GAMEDEV_COLLECTIONS)[number];

export const emptyProjects = (): ProjectsState => ({ version: 1, projects: [], ideas: [], focus: [], activeFocus: null });

export function validateProject(p: Pick<Project, 'name'>): string | null {
  return p.name.trim() ? null : 'Enter a project name';
}

/** Projects grouped by status in display order; empty groups omitted. */
export function groupProjects(projects: readonly Project[]): { status: ProjectStatus; projects: Project[] }[] {
  return STATUS_ORDER.map((status) => ({
    status,
    projects: projects
      .filter((p) => p.status === status)
      .sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999') || a.name.localeCompare(b.name)),
  })).filter((g) => g.projects.length > 0);
}

export function upsertProject(state: ProjectsState, project: Omit<Project, 'milestones' | 'log'> & Partial<Pick<Project, 'milestones' | 'log'>>): ProjectsState {
  const err = validateProject(project);
  if (err) throw new Error(err);
  const prev = state.projects.find((p) => p.id === project.id);
  const clean: Project = {
    ...project,
    name: project.name.trim(),
    milestones: project.milestones ?? prev?.milestones ?? [],
    log: project.log ?? prev?.log ?? [],
    links: project.links ?? prev?.links ?? [],
  };
  const exists = state.projects.some((p) => p.id === project.id);
  return {
    ...state,
    projects: exists ? state.projects.map((p) => (p.id === project.id ? clean : p)) : [...state.projects, clean],
  };
}

export function deleteProject(state: ProjectsState, id: string): ProjectsState {
  return { ...state, projects: state.projects.filter((p) => p.id !== id) };
}

export function addTask(state: ProjectsState, projectId: string, title: string, id: string): ProjectsState {
  const t = title.trim();
  if (!t) return state;
  return mapProject(state, projectId, (p) => ({ ...p, tasks: [...p.tasks, { id, title: t, done: false }] }));
}

export function toggleTask(state: ProjectsState, projectId: string, taskId: string, now = Date.now()): ProjectsState {
  return mapProject(state, projectId, (p) => ({
    ...p,
    tasks: p.tasks.map((t) => (t.id === taskId ? withDone(t, !t.done, now) : t)),
  }));
}

/** Sets done, stamping (or clearing) doneAt. */
export function withDone<T extends { done: boolean; doneAt?: number }>(item: T, done: boolean, now: number): T {
  const { doneAt: _drop, ...rest } = item;
  void _drop;
  return (done ? { ...rest, done, doneAt: now } : { ...rest, done }) as T;
}

export function removeTask(state: ProjectsState, projectId: string, taskId: string): ProjectsState {
  return mapProject(state, projectId, (p) => ({ ...p, tasks: p.tasks.filter((t) => t.id !== taskId) }));
}

export function mapProject(state: ProjectsState, id: string, fn: (p: Project) => Project): ProjectsState {
  return { ...state, projects: state.projects.map((p) => (p.id === id ? fn(p) : p)) };
}

export function taskProgress(p: Project): { done: number; total: number } {
  return { done: p.tasks.filter((t) => t.done).length, total: p.tasks.length };
}

export function migrateProjects(value: unknown): ProjectsState | null {
  const v = value as Partial<ProjectsState> | null;
  if (!v || v.version !== 1 || !Array.isArray(v.projects)) return null;
  const arr = <T,>(x: T[] | undefined): T[] => (Array.isArray(x) ? x : []);
  return {
    version: 1,
    projects: v.projects.map((p) => ({ ...p, tasks: arr(p.tasks), milestones: arr(p.milestones), log: arr(p.log), ...(p.links === undefined ? {} : { links: sanitizeLinks(p.links) }) })),
    ideas: arr(v.ideas),
    focus: arr(v.focus),
    activeFocus: v.activeFocus && typeof v.activeFocus.startedAt === 'number' ? v.activeFocus : null,
    // Game dev workspace collections (added later): keep only if present, so old data round-trips unchanged.
    ...Object.fromEntries(GAMEDEV_COLLECTIONS.filter((k) => v[k] !== undefined).map((k) => [k, arr(v[k] as unknown[])])),
  };
}

export function setProjectLinks(state: ProjectsState, projectId: string, links: ResourceLink[]): ProjectsState {
  return mapProject(state, projectId, (p) => ({ ...p, links }));
}

// ---------- milestones ----------

export function addMilestone(state: ProjectsState, projectId: string, m: { title: string; due?: DateKey }, id: string): ProjectsState {
  const title = m.title.trim();
  if (!title) return state;
  return mapProject(state, projectId, (p) => ({ ...p, milestones: [...p.milestones, { id, title, due: m.due, done: false }] }));
}

export function toggleMilestone(state: ProjectsState, projectId: string, id: string, now = Date.now()): ProjectsState {
  return mapProject(state, projectId, (p) => ({ ...p, milestones: p.milestones.map((m) => (m.id === id ? withDone(m, !m.done, now) : m)) }));
}

export function removeMilestone(state: ProjectsState, projectId: string, id: string): ProjectsState {
  return mapProject(state, projectId, (p) => ({ ...p, milestones: p.milestones.filter((m) => m.id !== id) }));
}

/** Milestones in roadmap order (the order they were added); dates are shown, not used for ordering. */
export function sortedMilestones(p: Project): Milestone[] {
  return [...p.milestones];
}

export function nextMilestone(p: Project): Milestone | undefined {
  return sortedMilestones(p).find((m) => !m.done);
}

// ---------- devlog ----------

export function addLogEntry(state: ProjectsState, projectId: string, date: DateKey, text: string, id: string): ProjectsState {
  const t = text.trim();
  if (!t) return state;
  return mapProject(state, projectId, (p) => ({ ...p, log: [...p.log, { id, date, text: t }] }));
}

export function removeLogEntry(state: ProjectsState, projectId: string, id: string): ProjectsState {
  return mapProject(state, projectId, (p) => ({ ...p, log: p.log.filter((e) => e.id !== id) }));
}

/** Newest first. */
export function sortedLog(p: Project): LogEntry[] {
  return [...p.log].sort((a, b) => b.date.localeCompare(a.date));
}

/** Markdown devlog draft from entries in [from, to], grouped by date (oldest first). */
export function devlogMarkdown(p: Project, from: DateKey, to: DateKey): string {
  const entries = p.log.filter((e) => e.date >= from && e.date <= to).sort((a, b) => a.date.localeCompare(b.date));
  const lines = [`# ${p.name} devlog (${from} to ${to})`, ''];
  if (!entries.length) return [...lines, '_No entries yet._'].join('\n');
  let current = '';
  for (const e of entries) {
    if (e.date !== current) {
      if (current) lines.push('');
      lines.push(`## ${e.date}`);
      current = e.date;
    }
    lines.push(...e.text.split('\n').map((l) => `- ${l}`));
  }
  const done = p.milestones.filter((m) => m.done).map((m) => m.title);
  const next = nextMilestone(p);
  if (done.length) lines.push('', `**Milestones done:** ${done.join(', ')}`);
  if (next) lines.push(`**Next milestone:** ${next.title}${next.due ? ` (${next.due})` : ''}`);
  return lines.join('\n');
}

// ---------- ideas ----------

export function addIdea(state: ProjectsState, text: string, today: DateKey, id: string): ProjectsState {
  const t = text.trim();
  return t ? { ...state, ideas: [{ id, text: t, createdAt: today }, ...state.ideas] } : state;
}

export function removeIdea(state: ProjectsState, id: string): ProjectsState {
  return { ...state, ideas: state.ideas.filter((i) => i.id !== id) };
}

/** Turns an idea into a Concept project (first line → name, rest → notes). */
export function promoteIdea(state: ProjectsState, ideaId: string, projectId: string): ProjectsState {
  const idea = state.ideas.find((i) => i.id === ideaId);
  if (!idea) return state;
  const [first, ...rest] = idea.text.split('\n');
  const project: Project = {
    id: projectId,
    name: first.trim().slice(0, 80),
    status: 'concept',
    notes: [rest.join('\n').trim(), `From the ideas inbox (${idea.createdAt}).`].filter(Boolean).join('\n'),
    tasks: [],
    milestones: [],
    log: [],
  };
  return { ...removeIdea(state, ideaId), projects: [...state.projects, project] };
}

// ---------- focus timer ----------

export function startFocus(state: ProjectsState, projectId: string | undefined, minutes: number, now: number, intent?: string, subjectId?: string): ProjectsState {
  const i = intent?.trim();
  return {
    ...state,
    activeFocus: { projectId: subjectId ? undefined : projectId, startedAt: now, minutes, ...(i ? { intent: i } : {}), ...(subjectId ? { subjectId } : {}) },
  };
}

export function focusRemainingMs(active: ActiveFocus, now: number): number {
  return Math.max(0, active.startedAt + active.minutes * 60_000 - now);
}

/** Minutes to log for a session stopped at `now`: rounded, capped at the plan, at least 1 once 30 s have passed. */
export function focusMinutesAt(a: ActiveFocus, now: number): number {
  const elapsed = Math.max(0, Math.min(now, a.startedAt + a.minutes * 60_000) - a.startedAt);
  if (elapsed < 30_000) return 0;
  return Math.min(a.minutes, Math.max(1, Math.round(elapsed / 60_000)));
}

/** Ends the running session and logs it (sessions shorter than 30 s are discarded). */
export function stopFocus(state: ProjectsState, now: number, id: string): ProjectsState {
  const a = state.activeFocus;
  if (!a) return state;
  const minutes = focusMinutesAt(a, now);
  const session: FocusSession = { id, projectId: a.projectId, start: a.startedAt, minutes, ...(a.intent ? { note: a.intent } : {}), ...(a.subjectId ? { subjectId: a.subjectId } : {}) };
  const focus = minutes >= 1 ? [...state.focus, session] : state.focus;
  return { ...state, focus, activeFocus: null };
}

/** If the running session's time is up, logs it in full and clears it; otherwise returns the state unchanged. */
export function completeFocusIfDue(state: ProjectsState, now: number, id: string): ProjectsState {
  const a = state.activeFocus;
  if (!a || focusRemainingMs(a, now) > 0) return state;
  return stopFocus(state, a.startedAt + a.minutes * 60_000, id);
}

/** Minutes per project id ('' for no project) for sessions starting in [fromMs, toMs). */
export function focusMinutesByProject(state: ProjectsState, fromMs: number, toMs: number): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of state.focus) {
    if (s.start < fromMs || s.start >= toMs || s.subjectId) continue;
    const k = s.projectId ?? '';
    out.set(k, (out.get(k) ?? 0) + s.minutes);
  }
  return out;
}
