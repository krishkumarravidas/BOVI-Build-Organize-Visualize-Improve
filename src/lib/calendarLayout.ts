import type { CollegeState } from './college';
import { habitsForDay, isCompleted } from './habits';
import type { TimelineItem } from './timeline';
import type { DateKey, HabitState } from './types';

export const PX_PER_MIN = 1.15;
const MIN_BLOCK_PX = 30;

export interface Positioned {
  item: TimelineItem;
  top: number;
  height: number;
  /** Column index within an overlapping cluster, and the cluster's column count. */
  lane: number;
  lanes: number;
}

export interface Gap {
  top: number;
  height: number;
  minutes: number;
}

export interface DayLayout {
  startHour: number;
  endHour: number;
  height: number;
  blocks: Positioned[];
  /** Point-in-time items (habits), positioned at their time. */
  points: { item: Extract<TimelineItem, { kind: 'habit' }>; top: number }[];
  gaps: Gap[];
}

const endOf = (i: TimelineItem) => (i.kind === 'habit' ? i.start : i.end);
const minsFrom = (dayStart: Date, d: Date) => (d.getTime() - dayStart.getTime()) / 60_000;

/**
 * Lays a day's timed items out on a vertical axis. The visible range covers 07:00–22:00 at least,
 * stretched to fit earlier/later items. Overlapping blocks share the width in lanes.
 */
export function layoutDay(items: readonly TimelineItem[], dayStart: Date, minGapMinutes = 20): DayLayout {
  const spans = items.filter((i): i is Exclude<TimelineItem, { kind: 'habit' }> => i.kind !== 'habit');
  const habits = items.filter((i): i is Extract<TimelineItem, { kind: 'habit' }> => i.kind === 'habit');

  const clampMin = (m: number) => Math.max(0, Math.min(24 * 60, m));
  let startHour = 7;
  let endHour = 22;
  for (const i of items) {
    startHour = Math.min(startHour, Math.floor(clampMin(minsFrom(dayStart, i.start)) / 60));
    endHour = Math.max(endHour, Math.ceil(clampMin(minsFrom(dayStart, endOf(i))) / 60));
  }
  endHour = Math.min(24, Math.max(endHour, startHour + 1));
  const origin = startHour * 60;
  const y = (m: number) => (clampMin(m) - origin) * PX_PER_MIN;

  // Cluster overlapping spans, then give each a lane (first free column).
  const sorted = [...spans].sort((a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime());
  const blocks: Positioned[] = [];
  let cluster: { item: (typeof sorted)[number]; lane: number }[] = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    const lanes = Math.max(1, ...cluster.map((c) => c.lane + 1));
    for (const c of cluster) {
      const top = y(minsFrom(dayStart, c.item.start));
      const height = Math.max(MIN_BLOCK_PX, y(minsFrom(dayStart, c.item.end)) - top);
      blocks.push({ item: c.item, top, height, lane: c.lane, lanes });
    }
    cluster = [];
  };
  for (const item of sorted) {
    if (item.start.getTime() >= clusterEnd) {
      flush();
      clusterEnd = -Infinity;
    }
    const laneEnds: number[] = [];
    for (const c of cluster) laneEnds[c.lane] = Math.max(laneEnds[c.lane] ?? -Infinity, c.item.end.getTime());
    let lane = 0;
    while (laneEnds[lane] !== undefined && laneEnds[lane] > item.start.getTime()) lane++;
    cluster.push({ item, lane });
    clusterEnd = Math.max(clusterEnd, item.end.getTime());
  }
  flush();

  // Free gaps between consecutive busy periods (merged spans), only within the visible range.
  const gaps: Gap[] = [];
  const merged: [number, number][] = [];
  for (const s of sorted) {
    const a = s.start.getTime();
    const b = s.end.getTime();
    const last = merged[merged.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else merged.push([a, b]);
  }
  for (let i = 1; i < merged.length; i++) {
    const minutes = Math.round((merged[i][0] - merged[i - 1][1]) / 60_000);
    if (minutes >= minGapMinutes) {
      const top = y((merged[i - 1][1] - dayStart.getTime()) / 60_000);
      gaps.push({ top, height: minutes * PX_PER_MIN, minutes });
    }
  }

  return {
    startHour,
    endHour,
    height: (endHour - startHour) * 60 * PX_PER_MIN,
    blocks,
    points: habits.map((item) => ({ item, top: y(minsFrom(dayStart, item.start)) })),
    gaps,
  };
}

/** Y offset for a moment within the laid-out range (for the "now" line). */
export function yFor(layout: DayLayout, dayStart: Date, at: Date): number | null {
  const m = minsFrom(dayStart, at);
  if (m < layout.startHour * 60 || m > layout.endHour * 60) return null;
  return (m - layout.startHour * 60) * PX_PER_MIN;
}

/**
 * Day score 0–100: share of the day's actionable items completed (habits, revision sessions,
 * assignments due that day). Null when there is nothing to do.
 */
export function dayScore(done: number, total: number): number | null {
  return total > 0 ? Math.round((done / total) * 100) : null;
}

export function formatGap(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

/** Done/total of a day's actionable items: scheduled habits, revision sessions and assignments due. */
export function dayProgress(habitState: HabitState, college: CollegeState, day: DateKey): { done: number; total: number } {
  const habits = habitsForDay(habitState, day);
  const studies = college.study.filter((s) => s.date === day);
  const due = college.assignments.filter((a) => a.due === day);
  return {
    done: habits.filter((h) => isCompleted(habitState, h.id, day)).length + studies.filter((s) => s.done).length + due.filter((a) => a.done).length,
    total: habits.length + studies.length + due.length,
  };
}
