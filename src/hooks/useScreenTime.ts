import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { addDays, fromDateKey, toDateKey } from '@/lib/dates';
import type { UsageRow } from '@/lib/screentime';
import type { DateKey } from '@/lib/types';
import { getAppUsage, hasUsageAccess, screenTimeAvailable } from '../../modules/screen-time';

export const WEEK_DAYS = 7;

interface State {
  status: 'unavailable' | 'loading' | 'no-access' | 'ready';
  today: UsageRow[];
  week: { day: DateKey; totalMs: number }[];
  error?: string;
}

const sumMs = (rows: UsageRow[]) => rows.reduce((a, r) => a + r.foregroundMs, 0);

/**
 * Today's per-app usage and 7-day totals. Reloads on screen focus and when the app returns to the
 * foreground (e.g. after granting Usage access in system settings).
 */
export function useScreenTime() {
  const [state, setState] = useState<State>({
    status: screenTimeAvailable ? 'loading' : 'unavailable',
    today: [],
    week: [],
  });
  const focused = useRef(false);

  const load = useCallback(async () => {
    if (!screenTimeAvailable) return;
    if (!hasUsageAccess()) {
      setState({ status: 'no-access', today: [], week: [] });
      return;
    }
    try {
      const todayKey = toDateKey(new Date());
      const days = Array.from({ length: WEEK_DAYS }, (_, i) => addDays(todayKey, i - (WEEK_DAYS - 1)));
      const perDay = await Promise.all(days.map((d) => getAppUsage(fromDateKey(d), fromDateKey(addDays(d, 1)))));
      setState({
        status: 'ready',
        today: perDay[perDay.length - 1],
        week: days.map((day, i) => ({ day, totalMs: sumMs(perDay[i]) })),
      });
    } catch {
      setState((s) => ({ ...s, status: 'ready', error: 'Could not read usage data.' }));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      load();
      return () => {
        focused.current = false;
      };
    }, [load]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && focused.current) load();
    });
    return () => sub.remove();
  }, [load]);

  return { ...state, reload: load };
}
