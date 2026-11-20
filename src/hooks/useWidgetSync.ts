import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { newId, useCollege } from '@/hooks/useCollege';
import { useHabits } from '@/hooks/useHabits';
import { useProjects } from '@/hooks/useProjects';
import { useSettings } from '@/hooks/useSettings';
import type { AgendaEvent } from '@/lib/agenda';
import { calendarSupported, fetchEvents, getCalendarAccess } from '@/lib/calendar';
import { addDays, fromDateKey, toDateKey } from '@/lib/dates';
import { applyCollegeActions, applyHabitActions, applyProjectActions, parseWidgetActions } from '@/lib/widgetActions';
import { buildWidgetData } from '@/lib/widgetData';
import { onWidgetAction, setWidgetData, takeWidgetActions, widgetAvailable } from '../../modules/bovi-widget';

/**
 * Keeps the home-screen widgets in sync both ways: replays what was tapped on a widget (habit ticks,
 * attendance, focus start/stop...) into the app's data, and pushes a fresh snapshot whenever data changes
 * or the app comes to / leaves the foreground.
 */
export function useWidgetSync() {
  const { college, ready: collegeReady, apply: applyCollege } = useCollege();
  const { state, ready: habitsReady, apply: applyHabits } = useHabits();
  const { state: projects, ready: projectsReady, apply: applyProjects } = useProjects();
  const { settings, ready: settingsReady } = useSettings();
  const [tick, setTick] = useState(0);
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const ready = collegeReady && habitsReady && projectsReady && settingsReady;

  const drain = useCallback(() => {
    const actions = parseWidgetActions(takeWidgetActions());
    if (!actions.length) return;
    applyHabits((s) => applyHabitActions(s, actions));
    applyCollege((s) => applyCollegeActions(s, actions));
    applyProjects((s) => applyProjectActions(s, actions, newId));
  }, [applyHabits, applyCollege, applyProjects]);

  useEffect(() => {
    if (!widgetAvailable || !ready) return;
    drain();
    const unsubscribe = onWidgetAction(drain);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') drain();
      // Refresh both when coming back and when leaving, so widgets are current while you're away.
      if (s === 'active' || s === 'background') setTick((t) => t + 1);
    });
    return () => {
      unsubscribe();
      sub.remove();
    };
  }, [ready, drain]);

  // Calendar events for the mini dial (today + tomorrow); never prompts for access.
  const calendarIds = settings.calendarIds;
  useEffect(() => {
    if (!widgetAvailable || !calendarSupported || !settingsReady) return;
    let cancelled = false;
    (async () => {
      try {
        if ((await getCalendarAccess()) !== 'granted') return;
        const today = toDateKey(new Date());
        const list = await fetchEvents(calendarIds, fromDateKey(today), fromDateKey(addDays(today, 2)));
        if (!cancelled) setEvents(list);
      } catch {
        // Widgets just won't show calendar events.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [calendarIds, settingsReady, tick]);

  useEffect(() => {
    if (!widgetAvailable || !ready) return;
    try {
      setWidgetData(
        buildWidgetData({
          college,
          habitState: state,
          projects,
          events,
          mode: settings.mode,
          screenLimitMin: settings.screenTimeLimitMin,
          now: new Date(),
          projectsLabel: settings.projectsTabName,
        }),
      );
    } catch {
      // Widgets are a convenience; never let them break the app.
    }
  }, [college, state, projects, events, settings.mode, settings.screenTimeLimitMin, settings.projectsTabName, ready, tick]);
}
