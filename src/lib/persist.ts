import AsyncStorage from '@react-native-async-storage/async-storage';

import type { KeyValueStore } from './storage';

/**
 * Loads JSON stored under `key`. Missing data → `initial()` (e.g. seed data).
 * Unreadable/unrecognised data → `fallback()` so a corrupt store never crashes the app or re-seeds over user data silently.
 */
export async function loadJson<T>(
  key: string,
  migrate: (value: unknown) => T | null,
  initial: () => T,
  fallback: () => T,
  store: KeyValueStore = AsyncStorage,
): Promise<T> {
  try {
    const raw = await store.getItem(key);
    if (raw === null) return initial();
    return migrate(JSON.parse(raw)) ?? fallback();
  } catch {
    return fallback();
  }
}

export async function saveJson<T>(key: string, value: T, store: KeyValueStore = AsyncStorage): Promise<void> {
  await store.setItem(key, JSON.stringify(value));
}
