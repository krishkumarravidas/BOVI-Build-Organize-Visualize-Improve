import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';

import { COLLEGE_KEY } from '@/lib/backup';
import { usePersistedState } from '@/hooks/usePersistedState';
import {
  addExtraClass,
  cancelOccurrence,
  editOccurrence,
  emptyCollege,
  migrateCollege,
  moveOccurrence,
  removeChange,
  restoreOccurrence,
  type Assignment,
  type AttendanceStatus,
  type ClassChange,
  type ClassOccurrence,
  type CollegeEvent,
  type CollegeState,
  type Exam,
  type GradeConfig,
  type MarkEntry,
  type StudySession,
  type Subject,
  type TimetableSlot,
} from '@/lib/college';
import { markAttendance } from '@/lib/collegeStats';
import type { DateKey } from '@/lib/types';

export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

type Upsert<T extends { id: string }> = (item: T) => void;

interface CollegeContextValue {
  college: CollegeState;
  ready: boolean;
  setProfile: (patch: Partial<Pick<CollegeState, 'profile' | 'defaultRoom'>>) => void;
  upsertSubject: Upsert<Subject>;
  deleteSubject: (id: string) => void;
  upsertSlot: Upsert<TimetableSlot>;
  deleteSlot: (id: string) => void;
  cancelClass: (date: DateKey, slotId: string) => void;
  editClass: (date: DateKey, slotId: string, patch: { start: string; end: string; room?: string; title?: string }) => void;
  restoreClass: (date: DateKey, slotId: string) => void;
  addExtra: (extra: Omit<Extract<ClassChange, { kind: 'extra' }>, 'id' | 'kind'>) => void;
  moveClass: (occ: ClassOccurrence, target: { date: DateKey; start: string; end: string }) => void;
  deleteChange: (id: string) => void;
  upsertExam: Upsert<Exam>;
  deleteExam: (id: string) => void;
  upsertEvent: Upsert<CollegeEvent>;
  deleteEvent: (id: string) => void;
  markAttendance: (occ: ClassOccurrence, status: AttendanceStatus | null) => void;
  setAttendanceTarget: (percent: number) => void;
  toggleTopic: (examId: string, topicId: string) => void;
  upsertAssignment: Upsert<Assignment>;
  deleteAssignment: (id: string) => void;
  toggleAssignment: (id: string) => void;
  upsertMark: Upsert<MarkEntry>;
  deleteMark: (id: string) => void;
  setGrade: (patch: Partial<GradeConfig>) => void;
  addStudy: (sessions: StudySession[]) => void;
  toggleStudy: (id: string) => void;
  deleteStudy: (id: string) => void;
  /** Apply a pure update (used to replay actions taken on home-screen widgets). */
  apply: (fn: (s: CollegeState) => CollegeState) => void;
}

const CollegeContext = createContext<CollegeContextValue | null>(null);

const upsert = <T extends { id: string }>(list: T[], item: T) =>
  list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];

export function CollegeProvider({ children }: { children: ReactNode }) {
  const [college, setCollege, ready] = usePersistedState(COLLEGE_KEY, migrateCollege, emptyCollege, emptyCollege);

  const set = useCallback((fn: (s: CollegeState) => CollegeState) => setCollege(fn), [setCollege]);

  const value = useMemo<CollegeContextValue>(
    () => ({
      college,
      ready,
      setProfile: (patch) => set((s) => ({ ...s, ...patch })),
      upsertSubject: (item) => set((s) => ({ ...s, subjects: upsert(s.subjects, item) })),
      deleteSubject: (id) =>
        set((s) => ({
          ...s,
          subjects: s.subjects.filter((x) => x.id !== id),
          // Keep classes, but they fall back to their title (or "Class").
          slots: s.slots.map((sl) => (sl.subjectId === id ? { ...sl, subjectId: undefined, title: sl.title || s.subjects.find((x) => x.id === id)?.name } : sl)),
          exams: s.exams.map((e) => (e.subjectId === id ? { ...e, subjectId: undefined, title: e.title || s.subjects.find((x) => x.id === id)?.name } : e)),
        })),
      upsertSlot: (item) => set((s) => ({ ...s, slots: upsert(s.slots, item) })),
      deleteSlot: (id) =>
        set((s) => ({
          ...s,
          slots: s.slots.filter((x) => x.id !== id),
          changes: s.changes.filter((c) => c.kind === 'extra' || c.slotId !== id),
        })),
      cancelClass: (date, slotId) => set((s) => cancelOccurrence(s, date, slotId, newId())),
      editClass: (date, slotId, patch) => set((s) => editOccurrence(s, date, slotId, patch, newId())),
      restoreClass: (date, slotId) => set((s) => restoreOccurrence(s, date, slotId)),
      addExtra: (extra) => set((s) => addExtraClass(s, extra, newId())),
      moveClass: (occ, target) => set((s) => moveOccurrence(s, occ, target, { cancelId: newId(), extraId: newId() })),
      deleteChange: (id) => set((s) => removeChange(s, id)),
      upsertExam: (item) => set((s) => ({ ...s, exams: upsert(s.exams, item) })),
      deleteExam: (id) => set((s) => ({ ...s, exams: s.exams.filter((x) => x.id !== id) })),
      upsertEvent: (item) => set((s) => ({ ...s, events: upsert(s.events, item) })),
      deleteEvent: (id) => set((s) => ({ ...s, events: s.events.filter((x) => x.id !== id) })),
      markAttendance: (occ, status) => set((s) => markAttendance(s, occ, status)),
      setAttendanceTarget: (percent) =>
        set((s) => ({ ...s, attendanceTarget: Math.min(100, Math.max(1, Math.round(percent))) })),
      toggleTopic: (examId, topicId) =>
        set((s) => ({
          ...s,
          exams: s.exams.map((e) =>
            e.id === examId ? { ...e, topics: (e.topics ?? []).map((t) => (t.id === topicId ? { ...t, done: !t.done } : t)) } : e,
          ),
        })),
      upsertAssignment: (item) => set((s) => ({ ...s, assignments: upsert(s.assignments, item) })),
      deleteAssignment: (id) => set((s) => ({ ...s, assignments: s.assignments.filter((x) => x.id !== id) })),
      toggleAssignment: (id) =>
        set((s) => ({ ...s, assignments: s.assignments.map((a) => (a.id === id ? { ...a, done: !a.done } : a)) })),
      upsertMark: (item) => set((s) => ({ ...s, marks: upsert(s.marks, item) })),
      deleteMark: (id) => set((s) => ({ ...s, marks: s.marks.filter((x) => x.id !== id) })),
      setGrade: (patch) => set((s) => ({ ...s, grade: { ...s.grade, ...patch } })),
      addStudy: (sessions) => set((s) => ({ ...s, study: [...s.study, ...sessions] })),
      toggleStudy: (id) => set((s) => ({ ...s, study: s.study.map((x) => (x.id === id ? { ...x, done: !x.done } : x)) })),
      deleteStudy: (id) => set((s) => ({ ...s, study: s.study.filter((x) => x.id !== id) })),
      apply: set,
    }),
    [college, ready, set],
  );

  return <CollegeContext.Provider value={value}>{children}</CollegeContext.Provider>;
}

export function useCollege(): CollegeContextValue {
  const ctx = useContext(CollegeContext);
  if (!ctx) throw new Error('useCollege must be used within <CollegeProvider>');
  return ctx;
}
