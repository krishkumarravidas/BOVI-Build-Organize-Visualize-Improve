import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useCollege } from '@/hooks/useCollege';
import { useHabits } from '@/hooks/useHabits';
import { useProjects } from '@/hooks/useProjects';
import { useSettings } from '@/hooks/useSettings';
import { autoBackupSupported, backupDue, writeBackupFile } from '@/lib/autoBackup';
import { buildBackup } from '@/lib/backup';

let lastError: string | null = null;
/** Shared across hook instances so the screen and the background run never write at once. */
let running = false;
/** Error from the most recent automatic backup attempt (shown on the Backup screen). */
export function lastAutoBackupError(): string | null {
  return lastError;
}

/**
 * Writes a backup into the chosen folder once a week, when the app opens or comes back to the
 * foreground. Also exposes `backupNow` for the Backup screen.
 */
export function useAutoBackup({ auto }: { auto: boolean }) {
  const { state: habits, ready: habitsReady } = useHabits();
  const { settings, ready: settingsReady, update } = useSettings();
  const { college, ready: collegeReady } = useCollege();
  const { state: projects, ready: projectsReady } = useProjects();
  const ready = habitsReady && settingsReady && collegeReady && projectsReady;
  const [tick, setTick] = useState(0);
  const dir = settings.autoBackupDir;

  const backupNow = useCallback(async (): Promise<{ ok: boolean; message: string }> => {
    if (!dir) return { ok: false, message: 'Choose a folder first.' };
    if (running) return { ok: false, message: 'A backup is already running.' };
    running = true;
    const now = new Date();
    const res = await writeBackupFile(dir, buildBackup({ habits, settings, college, projects }, now), now);
    running = false;
    if (res.ok) {
      lastError = null;
      update({ autoBackupAt: now.getTime() });
      return { ok: true, message: `Saved ${res.name}` };
    }
    lastError = res.error;
    return { ok: false, message: res.error };
  }, [dir, habits, settings, college, projects, update]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && setTick((t) => t + 1));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!auto || !autoBackupSupported || !ready || !dir || !backupDue(settings.autoBackupAt, Date.now())) return;
    backupNow();
    // Only re-check on load, on resume, or when the folder changes — not on every data edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, ready, dir, tick]);

  return { backupNow };
}
