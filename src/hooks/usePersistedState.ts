import { useEffect, useState } from 'react';

import { loadJson, saveJson } from '@/lib/persist';

/** State persisted to AsyncStorage under `key`; saves only after the initial load to avoid clobbering. */
export function usePersistedState<T>(
  key: string,
  migrate: (value: unknown) => T | null,
  initial: () => T,
  fallback: () => T,
) {
  const [state, setState] = useState<T>(fallback);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadJson(key, migrate, initial, fallback).then((loaded) => {
      if (cancelled) return;
      setState(loaded);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
    // Load once per key; the loader functions are module-level constants.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (ready) saveJson(key, state).catch(() => {});
  }, [key, state, ready]);

  return [state, setState, ready] as const;
}
