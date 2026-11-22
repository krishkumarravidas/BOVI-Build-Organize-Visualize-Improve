import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useCollege } from '@/hooks/useCollege';
import { useHabits } from '@/hooks/useHabits';
import { useProjects } from '@/hooks/useProjects';
import { useSettings } from '@/hooks/useSettings';
import { applyInbox, buildAgentSnapshot } from '@/lib/agentSync';
import { getSyncStatus, loadHandled, onClaudeSyncRequest, postSync, saveHandled, setSyncStatus, SyncError } from '@/lib/claudeSync';
import { toDateKey } from '@/lib/dates';

const DEBOUNCE_MS = 15_000;

/**
 * When the Claude connector is set up: syncs on launch, when the app comes back or goes to the
 * background, 15 s after data changes, and on "Sync now". Items Claude added are applied here.
 */
export function useClaudeSync() {
  const { college, ready: cReady, apply: applyCollege } = useCollege();
  const { state: habits, ready: hReady, apply: applyHabits } = useHabits();
  const { state: projects, ready: pReady, apply: applyProjects } = useProjects();
  const { settings, ready: sReady, update } = useSettings();
  const config = settings.claudeSync;
  const ready = cReady && hReady && pReady && sReady && !!config;

  // Latest values for the async sync without re-creating it on every change.
  const latest = useRef({ college, habits, projects, label: settings.projectsTabName });
  const running = useRef(false);
  const again = useRef(false);
  const syncRef = useRef<() => Promise<void>>(async () => {});
  const sync = () => syncRef.current();

  useEffect(() => {
    latest.current = { college, habits, projects, label: settings.projectsTabName };
  }, [college, habits, projects, settings.projectsTabName]);

  useEffect(() => {
    syncRef.current = async () => {
      if (!config) return;
      if (running.current) {
        again.current = true;
        return;
      }
      running.current = true;
      setSyncStatus({ state: 'syncing' });
      try {
        let handled = await loadHandled();
        let added = 0;
        // Two rounds at most: the second tells the server about items applied in the first.
        for (let round = 0; round < 2; round++) {
          const { college: c, habits: h, projects: p, label } = latest.current;
          const snapshot = buildAgentSnapshot({ college: c, habits: h, projects: p, projectsLabel: label, now: new Date() });
          const inbox = await postSync(config, snapshot, handled);
          handled = []; // the server has dropped those
          await saveHandled(handled);
          if (!inbox.length) break;
          const today = toDateKey(new Date());
          const result = applyInbox({ college: c, habits: h, projects: p }, inbox, today);
          applyCollege((s) => applyInbox({ college: s, habits: h, projects: p }, inbox, today).college);
          applyHabits((s) => applyInbox({ college: c, habits: s, projects: p }, inbox, today).habits);
          applyProjects((s) => applyInbox({ college: c, habits: h, projects: s }, inbox, today).projects);
          added += result.added.length;
          handled = result.handled;
          await saveHandled(handled);
          // Let the state updates land so the next snapshot includes the new items.
          await new Promise((r) => setTimeout(r, 300));
        }
        const at = Date.now();
        setSyncStatus({ state: 'ok', at, added });
        update({ claudeSyncAt: at });
      } catch (e) {
        setSyncStatus({ state: 'error', at: Date.now(), message: e instanceof SyncError ? e.message : 'Sync failed.' });
      } finally {
        running.current = false;
        if (again.current) {
          again.current = false;
          void syncRef.current();
        }
      }
    };
  }, [config, applyCollege, applyHabits, applyProjects, update]);

  // Launch, foreground/background, and "Sync now".
  useEffect(() => {
    if (!ready) return;
    void sync();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' || s === 'background') void sync();
    });
    const off = onClaudeSyncRequest(() => void sync());
    return () => {
      sub.remove();
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync reads the latest function from a ref
  }, [ready, config]);

  // Data changed: sync a little later (batches quick edits).
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => void sync(), DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-armed by data changes on purpose
  }, [ready, college, habits, projects]);

  // Turned off: reset the status line.
  useEffect(() => {
    if (!config && getSyncStatus().state !== 'idle') setSyncStatus({ state: 'idle' });
  }, [config]);
}
