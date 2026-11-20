import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useSettings } from '@/hooks/useSettings';
import type { AgendaEvent } from '@/lib/agenda';
import {
  calendarSupported,
  fetchEvents,
  getCalendarAccess,
  requestCalendarAccess,
  type CalendarAccess,
} from '@/lib/calendar';
import { addDays, fromDateKey, toDateKey } from '@/lib/dates';

interface State {
  access: CalendarAccess | 'loading';
  events: AgendaEvent[];
  firstDay: string;
  refreshing: boolean;
  error?: string;
}

/**
 * Device-calendar events for `numDays` days starting at `fromDay` (default: today). Reloads whenever the
 * screen gains focus or the range changes. Never prompts on its own; call `requestAccess` from a user action.
 */
export function useCalendarEvents(numDays: number, fromDay?: string) {
  const { settings, ready } = useSettings();
  const selected = settings.calendarIds;
  const [state, setState] = useState<State>({
    access: calendarSupported ? 'loading' : 'blocked',
    events: [],
    firstDay: toDateKey(new Date()),
    refreshing: false,
  });

  const load = useCallback(
    async (opts: { request?: boolean } = {}) => {
      const firstDay = fromDay ?? toDateKey(new Date());
      if (!calendarSupported) {
        setState((s) => ({ ...s, firstDay }));
        return;
      }
      setState((s) => ({ ...s, refreshing: true, error: undefined }));
      try {
        const access = opts.request ? await requestCalendarAccess() : await getCalendarAccess();
        const events =
          access === 'granted'
            ? await fetchEvents(selected, fromDateKey(firstDay), fromDateKey(addDays(firstDay, numDays)))
            : [];
        setState({ access, events, firstDay, refreshing: false });
      } catch {
        setState((s) => ({
          ...s,
          firstDay,
          access: s.access === 'loading' ? 'ask' : s.access,
          refreshing: false,
          error: 'Could not read your calendar.',
        }));
      }
    },
    [selected, numDays, fromDay],
  );

  useFocusEffect(
    useCallback(() => {
      if (ready) load();
    }, [ready, load]),
  );

  return {
    ...state,
    refresh: () => load(),
    requestAccess: () => load({ request: true }),
  };
}
