import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { atTime, toDateKey } from '@/lib/dates';
import type { DateKey } from '@/lib/types';
import { getAppUsage, hasUsageAccess, screenTimeAvailable } from '../../modules/screen-time';

/**
 * Minutes of phone use per hour (24 values) for a past or current day; null when unavailable
 * (web, no Usage access, or a future day).
 */
export function useHourlyScreenTime(day: DateKey): number[] | null {
  const [data, setData] = useState<{ day: DateKey; minutes: number[] } | null>(null);

  const load = useCallback(async () => {
    const today = toDateKey(new Date());
    if (!screenTimeAvailable || day > today || !hasUsageAccess()) {
      setData(null);
      return;
    }
    try {
      const now = Date.now();
      const minutes = await Promise.all(
        Array.from({ length: 24 }, async (_, h) => {
          const start = atTime(day, `${String(h).padStart(2, '0')}:00`);
          if (start.getTime() > now) return 0;
          const end = new Date(start.getTime() + 3_600_000);
          const rows = await getAppUsage(start, end);
          return Math.min(60, Math.round(rows.reduce((a, r) => a + r.foregroundMs, 0) / 60_000));
        }),
      );
      setData({ day, minutes });
    } catch {
      setData(null);
    }
  }, [day]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return data && data.day === day ? data.minutes : null;
}
