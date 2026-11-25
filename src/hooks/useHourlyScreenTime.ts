import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { atTime, toDateKey } from '@/lib/dates';
import type { HourUsage } from '@/lib/screentime';
import type { DateKey } from '@/lib/types';
import { getAppUsage, hasUsageAccess, screenTimeAvailable } from '../../modules/screen-time';

export type HourlyScreenTime =
  /** Web, a build without the module, or a future day: nothing to show. */
  | { status: 'unavailable' }
  /** Android without Usage access: show how to turn it on. */
  | { status: 'no-access' }
  | { status: 'ok'; hours: HourUsage[] };

/** Phone use per hour (24 entries, with each hour's top apps) for a past or current day. */
export function useHourlyScreenTime(day: DateKey): HourlyScreenTime {
  const [data, setData] = useState<{ day: DateKey; value: HourlyScreenTime } | null>(null);

  const load = useCallback(async () => {
    const today = toDateKey(new Date());
    if (!screenTimeAvailable || day > today) return setData({ day, value: { status: 'unavailable' } });
    if (!hasUsageAccess()) return setData({ day, value: { status: 'no-access' } });
    try {
      const now = Date.now();
      const hours = await Promise.all(
        Array.from({ length: 24 }, async (_, h): Promise<HourUsage> => {
          const start = atTime(day, `${String(h).padStart(2, '0')}:00`);
          if (start.getTime() > now) return { minutes: 0, top: [] };
          const end = new Date(start.getTime() + 3_600_000);
          const rows = (await getAppUsage(start, end)).filter((r) => r.foregroundMs > 0).sort((a, b) => b.foregroundMs - a.foregroundMs);
          const minutes = Math.min(60, Math.round(rows.reduce((a, r) => a + r.foregroundMs, 0) / 60_000));
          return { minutes, top: rows.slice(0, 3) };
        }),
      );
      setData({ day, value: { status: 'ok', hours } });
    } catch {
      setData({ day, value: { status: 'unavailable' } });
    }
  }, [day]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return data && data.day === day ? data.value : { status: 'unavailable' };
}
