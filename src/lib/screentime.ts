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
