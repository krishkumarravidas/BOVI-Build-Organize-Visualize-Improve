import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { toDateKey } from '@/lib/dates';
import { addHabit, archiveHabit, createHabit, emptyState, setCompleted, updateHabit, type NewHabitInput } from '@/lib/habits';
import { createBlock, type NewBlockInput } from '@/lib/schedule';
import { loadState, saveState } from '@/lib/storage';
import type { DateKey, Habit, HabitState, ScheduleBlock } from '@/lib/types';

interface HabitsContextValue {
  state: HabitState;
  /** False until persisted data has been read; avoid rendering "empty" UI before then. */
  ready: boolean;
  add: (input: NewHabitInput) => Habit;
  update: (id: string, patch: Partial<Omit<Habit, 'id' | 'createdAt'>>) => void;
  archive: (id: string) => void;
  toggle: (habitId: string, day: DateKey, done: boolean) => void;
  addBlock: (input: NewBlockInput) => ScheduleBlock;
  updateBlock: (id: string, input: NewBlockInput) => void;
  deleteBlock: (id: string) => void;
  /** Apply a pure update (used to replay actions taken on home-screen widgets). */
  apply: (fn: (s: HabitState) => HabitState) => void;
}

const HabitsContext = createContext<HabitsContextValue | null>(null);

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export function HabitsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<HabitState>(emptyState);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadState().then((loaded) => {
      if (cancelled) return;
      setState(loaded);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist after load only, so the initial empty state never overwrites stored data.
  useEffect(() => {
    if (ready) saveState(state).catch(() => {});
  }, [state, ready]);

  const add = useCallback((input: NewHabitInput) => {
    const habit = createHabit(input, toDateKey(new Date()), newId());
    setState((s) => addHabit(s, habit));
    return habit;
  }, []);
  const update = useCallback(
    (id: string, patch: Partial<Omit<Habit, 'id' | 'createdAt'>>) => setState((s) => updateHabit(s, id, patch)),
    [],
  );
  const archive = useCallback(
    (id: string) => setState((s) => archiveHabit(s, id, toDateKey(new Date()))),
    [],
  );
  const toggle = useCallback(
    (habitId: string, day: DateKey, done: boolean) => setState((s) => setCompleted(s, habitId, day, done)),
    [],
  );

  const addBlock = useCallback((input: NewBlockInput) => {
    const block = createBlock(input, newId());
    setState((s) => ({ ...s, blocks: [...s.blocks, block] }));
    return block;
  }, []);
  const updateBlock = useCallback((id: string, input: NewBlockInput) => {
    const next = createBlock(input, id); // validates
    setState((s) => ({ ...s, blocks: s.blocks.map((b) => (b.id === id ? next : b)) }));
  }, []);
  const deleteBlock = useCallback(
    (id: string) => setState((s) => ({ ...s, blocks: s.blocks.filter((b) => b.id !== id) })),
    [],
  );

  const value = useMemo(
    () => ({ state, ready, add, update, archive, toggle, addBlock, updateBlock, deleteBlock, apply: setState }),
    [state, ready, add, update, archive, toggle, addBlock, updateBlock, deleteBlock],
  );
  return <HabitsContext.Provider value={value}>{children}</HabitsContext.Provider>;
}

export function useHabits(): HabitsContextValue {
  const ctx = useContext(HabitsContext);
  if (!ctx) throw new Error('useHabits must be used within <HabitsProvider>');
  return ctx;
}
