export interface UsageRow {
  packageName: string;
  label: string;
  foregroundMs: number;
}

const MINUTE = 60_000;

/** "<1m", "45m", "2h 5m", "3h". */
export function formatDuration(ms: number): string {
  const totalMin = Math.floor(Math.max(0, ms) / MINUTE);
  if (totalMin < 1) return '<1m';
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export interface UsageSummary {
  totalMs: number;
  top: UsageRow[];
  /** Combined time of apps beyond the top N. */
  otherMs: number;
  otherCount: number;
}

/** Totals usage and splits it into the `topN` biggest apps plus an "other" remainder. */
export function summarizeUsage(rows: readonly UsageRow[], topN = 5): UsageSummary {
  const sorted = [...rows].filter((r) => r.foregroundMs > 0).sort((a, b) => b.foregroundMs - a.foregroundMs);
  const top = sorted.slice(0, topN);
  const rest = sorted.slice(topN);
  const sum = (xs: UsageRow[]) => xs.reduce((acc, r) => acc + r.foregroundMs, 0);
  return { totalMs: sum(sorted), top, otherMs: sum(rest), otherCount: rest.length };
}

export interface LimitStatus {
  /** 0..1+ share of the limit used. */
  ratio: number;
  over: boolean;
  remainingMs: number;
}

/** Progress against a daily limit in minutes; null when no limit is set. */
export function limitStatus(totalMs: number, limitMin: number | null): LimitStatus | null {
  if (!limitMin || limitMin <= 0) return null;
  const limitMs = limitMin * MINUTE;
  return { ratio: totalMs / limitMs, over: totalMs >= limitMs, remainingMs: Math.max(0, limitMs - totalMs) };
}

// ---------- phone use per hour (the dial's outer ring) ----------

export interface HourUsage {
  /** Minutes of phone use in this hour (0–60). */
  minutes: number;
  /** Biggest apps that hour, largest first. */
  top: UsageRow[];
}

export type UsageLevel = 'none' | 'light' | 'medium' | 'heavy';

/** How an hour is drawn: light under 15 min, medium 15–29, heavy 30+. */
export function usageLevel(minutes: number): UsageLevel {
  if (minutes <= 0) return 'none';
  if (minutes < 15) return 'light';
  if (minutes < 30) return 'medium';
  return 'heavy';
}

export interface WindowUsage {
  /** Hours of this day shown (0–23), in order. */
  hours: { hour: number; minutes: number; top: UsageRow[] }[];
  totalMin: number;
  /** The hour with the most use, if any. */
  busiest: { hour: number; minutes: number; top: UsageRow[] } | null;
  /** Hours with 30+ minutes. */
  heavyHours: number;
  /** Apps across the window, largest first. */
  topApps: UsageRow[];
}

/** Phone use for `count` hours starting at `startHour` (hours outside 0–23 are left out). */
export function windowUsage(day: readonly HourUsage[], startHour: number, count = 6): WindowUsage {
  const hours = [];
  for (let h = startHour; h < startHour + count; h++) {
    if (h < 0 || h > 23 || !day[h]) continue;
    hours.push({ hour: h, minutes: day[h].minutes, top: day[h].top });
  }
  const totalMin = hours.reduce((a, h) => a + h.minutes, 0);
  const busiest = hours.reduce<WindowUsage['busiest']>((b, h) => (h.minutes > 0 && (!b || h.minutes > b.minutes) ? h : b), null);
  const byApp = new Map<string, UsageRow>();
  for (const h of hours)
    for (const r of h.top) {
      const cur = byApp.get(r.packageName);
      byApp.set(r.packageName, cur ? { ...cur, foregroundMs: cur.foregroundMs + r.foregroundMs } : { ...r });
    }
  return {
    hours,
    totalMin,
    busiest,
    heavyHours: hours.filter((h) => h.minutes >= 30).length,
    topApps: [...byApp.values()].sort((a, b) => b.foregroundMs - a.foregroundMs).slice(0, 3),
  };
}

/** "9 AM", "12 PM", "12 AM". */
export function hourLabel(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  return `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;
}
