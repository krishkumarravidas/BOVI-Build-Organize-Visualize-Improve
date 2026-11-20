import { router } from 'expo-router';
import { useEffect } from 'react';

import { useCollege } from '@/hooks/useCollege';
import { useHabits } from '@/hooks/useHabits';
import { useProjects } from '@/hooks/useProjects';
import { useSettings } from '@/hooks/useSettings';

/**
 * Sends a brand-new install to the setup screen once. Installs that already have data (from before
 * setup existed, or restored from a backup) are simply marked as set up.
 */
export function useSetupGate() {
  const { settings, ready: settingsReady, update } = useSettings();
  const { college, ready: collegeReady } = useCollege();
  const { state, ready: habitsReady } = useHabits();
  const { state: projects, ready: projectsReady } = useProjects();
  const ready = settingsReady && collegeReady && habitsReady && projectsReady;
  const hasData = college.subjects.length > 0 || college.slots.length > 0 || projects.projects.length > 0 || state.habits.length > 0 || !!college.attendanceSyncedAt;

  useEffect(() => {
    if (!ready || settings.setupDone) return;
    if (hasData) update({ setupDone: true });
    else router.replace('/setup');
  }, [ready, settings.setupDone, hasData, update]);
}
