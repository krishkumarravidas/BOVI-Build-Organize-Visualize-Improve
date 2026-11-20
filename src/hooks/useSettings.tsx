import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { defaultSettings, loadSettings, saveSettings, type Settings } from '@/lib/settings';

interface SettingsContextValue {
  settings: Settings;
  ready: boolean;
  update: (patch: Partial<Settings>) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadSettings().then((loaded) => {
      if (cancelled) return;
      setSettings(loaded);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (ready) saveSettings(settings).catch(() => {});
  }, [settings, ready]);

  const update = useCallback((patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })), []);
  const value = useMemo(() => ({ settings, ready, update }), [settings, ready, update]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within <SettingsProvider>');
  return ctx;
}
