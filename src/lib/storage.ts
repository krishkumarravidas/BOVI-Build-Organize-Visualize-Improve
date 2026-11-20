import AsyncStorage from '@react-native-async-storage/async-storage';

import { emptyState } from './habits';
import type { HabitState } from './types';

export const HABITS_KEY = 'habit-tracker/state';
const KEY = HABITS_KEY;

/** Minimal surface so storage can be swapped (e.g. SQLite) or faked in tests. */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

interface StoredState {
  version?: number;
  habits?: unknown;
  completions?: unknown;
  blocks?: unknown;
}

/** Accepts the current format and older ones, upgrading as needed. Returns null for anything unrecognised. */
export function migrateState(value: unknown): HabitState | null {
  const v = value as StoredState | null;
  if (!v || typeof v !== 'object') return null;
  if (!Array.isArray(v.habits) || typeof v.completions !== 'object' || v.completions === null) return null;
  const todos = Array.isArray((v as { todos?: unknown }).todos) ? { todos: (v as { todos: HabitState['todos'] }).todos } : {};
  const base = { habits: v.habits as HabitState['habits'], completions: v.completions as HabitState['completions'], ...todos };
  if (v.version === 1) return { version: 2, ...base, blocks: [] };
  if (v.version === 2 && Array.isArray(v.blocks)) return { version: 2, ...base, blocks: v.blocks as HabitState['blocks'] };
  return null;
}

export async function loadState(store: KeyValueStore = AsyncStorage): Promise<HabitState> {
  try {
    const raw = await store.getItem(KEY);
    if (!raw) return emptyState();
    const parsed: unknown = JSON.parse(raw);
    return migrateState(parsed) ?? emptyState();
  } catch {
    // Corrupt or unreadable data: start fresh rather than crash on launch.
    return emptyState();
  }
}

export async function saveState(state: HabitState, store: KeyValueStore = AsyncStorage): Promise<void> {
  await store.setItem(KEY, JSON.stringify(state));
}
