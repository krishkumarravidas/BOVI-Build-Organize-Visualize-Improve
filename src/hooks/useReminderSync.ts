import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useCollege } from '@/hooks/useCollege';
import { useHabits } from '@/hooks/useHabits';
import { useProjects } from '@/hooks/useProjects';
import { useSettings } from '@/hooks/useSettings';
import { planAssignmentReminders, planExamReminders } from '@/lib/examReminders';
import { planBriefings } from '@/lib/briefing';
import { gamedevReminders } from '@/lib/gamedevReminders';
import { syncReminders } from '@/lib/notifications';
import { taskReminders } from '@/lib/todos';

/**
 * Keeps OS-scheduled reminders in step with habits, schedule blocks, exams, assignments, the focus timer and settings.
 * Also re-syncs when the app comes to the foreground, so one-shot exam reminders stay current.
 */
export function useReminderSync() {
  const { state, ready: habitsReady } = useHabits();
  const { settings, ready: settingsReady } = useSettings();
  const { college, ready: collegeReady } = useCollege();
  const { state: projectsState, ready: projectsReady } = useProjects();
  const activeFocus = projectsState.activeFocus;
  const focusProject = projectsState.projects.find((p) => p.id === activeFocus?.projectId)?.name;
  const [resumeTick, setResumeTick] = useState(0);
  const { habits, blocks } = state;
  const { remindersEnabled, examReminders, briefingTime } = settings;

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setResumeTick((t) => t + 1);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!habitsReady || !settingsReady || !collegeReady || !projectsReady) return;
    const now = new Date();
    const dated = examReminders ? [...planExamReminders(college, now), ...planAssignmentReminders(college, now)] : [];
    if (activeFocus) {
      const end = new Date(activeFocus.startedAt + activeFocus.minutes * 60_000);
      if (end > now) {
        dated.push({
          id: 'focus:end',
          title: 'Focus session done',
          body: `${activeFocus.minutes} min${focusProject ? ` on ${focusProject}` : ''}. Open the app to log it and take a break.`,
          date: end,
        });
      }
    }
    dated.push(...gamedevReminders(projectsState, now));
    if (remindersEnabled) dated.push(...taskReminders(state, now));
    dated.push(...planBriefings(now, briefingTime, { college, habitState: state, projects: projectsState, projectsLabel: settings.projectsTabName }));
    syncReminders({ habits, blocks, dated }, remindersEnabled).catch(() => {});
  }, [habits, blocks, college, remindersEnabled, examReminders, habitsReady, settingsReady, collegeReady, projectsReady, activeFocus, focusProject, resumeTick, projectsState, briefingTime, state, settings.projectsTabName]);
}
