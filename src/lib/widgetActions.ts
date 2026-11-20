import { resolveDay, type CollegeState } from './college';
import { attendanceFor, markAttendance } from './collegeStats';
import { setCompleted } from './habits';
import { startFocus, stopFocus, type ProjectsState } from './projects';
import type { DateKey, HabitState } from './types';

/** Something done on a home-screen widget while the app wasn't looking; queued natively, replayed here. */
export type WidgetAction =
  | { type: 'habit'; habitId: string; day: DateKey; done: boolean }
  | { type: 'attend'; date: DateKey; key: string; status: 'present' | 'absent' }
  | { type: 'assignment'; id: string }
  | { type: 'focusStart'; projectId?: string; minutes: number; at: number }
  | { type: 'focusStop'; at: number };

const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Parses the native queue, dropping anything malformed. */
export function parseWidgetActions(json: string | null | undefined): WidgetAction[] {
  if (!json) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const out: WidgetAction[] = [];
  for (const a of raw as Record<string, unknown>[]) {
    if (!a || typeof a !== 'object') continue;
    switch (a.type) {
      case 'habit':
        if (isStr(a.habitId) && isStr(a.day) && typeof a.done === 'boolean') out.push({ type: 'habit', habitId: a.habitId, day: a.day, done: a.done });
        break;
      case 'attend':
        if (isStr(a.date) && isStr(a.key) && (a.status === 'present' || a.status === 'absent')) out.push({ type: 'attend', date: a.date, key: a.key, status: a.status });
        break;
      case 'assignment':
        if (isStr(a.id)) out.push({ type: 'assignment', id: a.id });
        break;
      case 'focusStart':
        if (isNum(a.minutes) && a.minutes > 0 && isNum(a.at)) out.push({ type: 'focusStart', projectId: isStr(a.projectId) ? a.projectId : undefined, minutes: a.minutes, at: a.at });
        break;
      case 'focusStop':
        if (isNum(a.at)) out.push({ type: 'focusStop', at: a.at });
        break;
    }
  }
  return out;
}

export function applyHabitActions(state: HabitState, actions: readonly WidgetAction[]): HabitState {
  let s = state;
  for (const a of actions) {
    if (a.type === 'habit' && s.habits.some((h) => h.id === a.habitId)) s = setCompleted(s, a.habitId, a.day, a.done);
  }
  return s;
}

export function applyCollegeActions(state: CollegeState, actions: readonly WidgetAction[]): CollegeState {
  let s = state;
  for (const a of actions) {
    if (a.type === 'attend') {
      const occ = resolveDay(s, a.date).find((o) => o.key === a.key);
      // Only classes that still exist; never overwrite a mark made in the app.
      if (occ && occ.subject && !attendanceFor(s, a.date, a.key)) s = markAttendance(s, occ, a.status);
    } else if (a.type === 'assignment') {
      s = { ...s, assignments: s.assignments.map((x) => (x.id === a.id ? { ...x, done: true } : x)) };
    }
  }
  return s;
}

export function applyProjectActions(state: ProjectsState, actions: readonly WidgetAction[], newId: () => string): ProjectsState {
  let s = state;
  for (const a of actions) {
    if (a.type === 'focusStart') {
      if (s.activeFocus) s = stopFocus(s, a.at, newId());
      const projectId = a.projectId && s.projects.some((p) => p.id === a.projectId) ? a.projectId : undefined;
      s = startFocus(s, projectId, a.minutes, a.at);
    } else if (a.type === 'focusStop') {
      // A stop for a session that already ended (and was saved) is a no-op.
      if (s.activeFocus && s.activeFocus.startedAt <= a.at) s = stopFocus(s, a.at, newId());
    }
  }
  return s;
}
