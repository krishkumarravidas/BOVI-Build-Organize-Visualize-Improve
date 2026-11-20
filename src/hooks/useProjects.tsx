import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { newId } from '@/hooks/useCollege';
import { PROJECTS_KEY } from '@/lib/backup';
import { usePersistedState } from '@/hooks/usePersistedState';
import { toDateKey } from '@/lib/dates';
import { deleteProjectData } from '@/lib/gamedev';
import { deleteStoredImage } from '@/lib/images';
import {
  addIdea,
  addLogEntry,
  addMilestone,
  addTask,
  completeFocusIfDue,
  deleteProject,
  focusMinutesAt,
  emptyProjects,
  migrateProjects,
  promoteIdea,
  removeIdea,
  removeLogEntry,
  removeMilestone,
  removeTask,
  startFocus,
  stopFocus,
  toggleMilestone,
  toggleTask,
  upsertProject,
  type ProjectsState,
} from '@/lib/projects';
import type { DateKey } from '@/lib/types';

type SaveInput = Parameters<typeof upsertProject>[1];

interface ProjectsContextValue {
  state: ProjectsState;
  projects: ProjectsState['projects'];
  ready: boolean;
  save: (p: SaveInput) => void;
  remove: (id: string) => void;
  addTask: (projectId: string, title: string) => void;
  toggleTask: (projectId: string, taskId: string) => void;
  removeTask: (projectId: string, taskId: string) => void;
  addMilestone: (projectId: string, m: { title: string; due?: DateKey }) => void;
  toggleMilestone: (projectId: string, id: string) => void;
  removeMilestone: (projectId: string, id: string) => void;
  addLog: (projectId: string, text: string) => void;
  removeLog: (projectId: string, id: string) => void;
  addIdea: (text: string) => void;
  removeIdea: (id: string) => void;
  promoteIdea: (id: string) => string;
  startFocus: (projectId: string | undefined, minutes: number, intent?: string, subjectId?: string) => void;
  stopFocus: () => void;
  /** Last session saved (or discarded) — for a confirmation message. */
  lastFocus: { minutes: number; projectId?: string; subjectId?: string; at: number; startedAt: number; intent?: string } | null;
  /** Dismiss the post-session prompt. */
  clearLastFocus: () => void;
  /** Save "how it went / what's next" for the last session: devlog entry, session note and the project's next step. */
  saveSessionNote: (outcome: string, next: string) => void;
  /** Apply a pure update (used to replay actions taken on home-screen widgets). */
  apply: (fn: (s: ProjectsState) => ProjectsState) => void;
}

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [state, setState, ready] = usePersistedState(PROJECTS_KEY, migrateProjects, emptyProjects, emptyProjects);
  const [lastFocus, setLastFocus] = useState<ProjectsContextValue['lastFocus']>(null);
  const active = state.activeFocus;

  // Save a finished session automatically: on load, every few seconds while running, and when the app returns.
  useEffect(() => {
    if (!ready || !active) return;
    const check = () => {
      const now = Date.now();
      if (now < active.startedAt + active.minutes * 60_000) return;
      setLastFocus({ minutes: active.minutes, projectId: active.projectId, subjectId: active.subjectId, at: now, startedAt: active.startedAt, intent: active.intent });
      setState((s) => completeFocusIfDue(s, now, newId()));
    };
    check();
    const timer = setInterval(check, 5000);
    const sub = AppState.addEventListener('change', (st) => st === 'active' && check());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [ready, active, setState]);

  const value = useMemo<ProjectsContextValue>(
    () => ({
      state,
      projects: state.projects,
      ready,
      save: (p) => setState((s) => upsertProject(s, p)),
      remove: (id) => {
        // Workspace data goes with the project, including screenshots/reference images stored on the phone.
        for (const uri of [...(state.refs ?? []), ...(state.bugs ?? [])].filter((x) => x.projectId === id).map((x) => ('uri' in x ? x.uri : x.image))) deleteStoredImage(uri);
        setState((s) => deleteProjectData(deleteProject(s, id), id));
      },
      addTask: (projectId, title) => setState((s) => addTask(s, projectId, title, newId())),
      toggleTask: (projectId, taskId) => setState((s) => toggleTask(s, projectId, taskId)),
      removeTask: (projectId, taskId) => setState((s) => removeTask(s, projectId, taskId)),
      addMilestone: (projectId, m) => setState((s) => addMilestone(s, projectId, m, newId())),
      toggleMilestone: (projectId, id) => setState((s) => toggleMilestone(s, projectId, id)),
      removeMilestone: (projectId, id) => setState((s) => removeMilestone(s, projectId, id)),
      addLog: (projectId, text) => setState((s) => addLogEntry(s, projectId, toDateKey(new Date()), text, newId())),
      removeLog: (projectId, id) => setState((s) => removeLogEntry(s, projectId, id)),
      addIdea: (text) => setState((s) => addIdea(s, text, toDateKey(new Date()), newId())),
      removeIdea: (id) => setState((s) => removeIdea(s, id)),
      promoteIdea: (id) => {
        const projectId = newId();
        setState((s) => promoteIdea(s, id, projectId));
        return projectId;
      },
      startFocus: (projectId, minutes, intent, subjectId) => {
        setLastFocus(null);
        setState((s) => startFocus(s, projectId, minutes, Date.now(), intent, subjectId));
      },
      stopFocus: () => {
        const now = Date.now();
        const a = state.activeFocus;
        if (a) setLastFocus({ minutes: focusMinutesAt(a, now), projectId: a.projectId, subjectId: a.subjectId, at: now, startedAt: a.startedAt, intent: a.intent });
        setState((s) => stopFocus(s, now, newId()));
      },
      lastFocus,
      clearLastFocus: () => setLastFocus(null),
      saveSessionNote: (outcome, next) => {
        const last = lastFocus;
        if (!last) return;
        const o = outcome.trim();
        const n = next.trim();
        const note = [last.intent, o].filter(Boolean).join(' → ');
        setState((s) => {
          let out: ProjectsState = { ...s, focus: s.focus.map((f) => (f.start === last.startedAt && f.projectId === last.projectId ? { ...f, ...(note ? { note } : {}) } : f)) };
          if (last.projectId && (o || n || last.intent)) {
            const text = [`Focus ${last.minutes} min${last.intent ? `: ${last.intent}` : ''}${o ? ` → ${o}` : ''}`, n ? `Next: ${n}` : ''].filter(Boolean).join('\n');
            out = addLogEntry(out, last.projectId, toDateKey(new Date(last.at)), text, newId());
            if (n) out = { ...out, projects: out.projects.map((p) => (p.id === last.projectId ? { ...p, nextStep: n } : p)) };
          }
          return out;
        });
        setLastFocus(null);
      },
      apply: setState,
    }),
    [state, ready, setState, lastFocus],
  );

  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

export function useProjects(): ProjectsContextValue {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error('useProjects must be used within <ProjectsProvider>');
  return ctx;
}
