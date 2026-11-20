import type { TimelineItem } from './timeline';

export type PeriodKey = 'night' | 'morning' | 'afternoon' | 'evening';

export const PERIODS: { key: PeriodKey; label: string; startHour: number }[] = [
  { key: 'night', label: 'Night', startHour: 0 },
  { key: 'morning', label: 'Morning', startHour: 6 },
  { key: 'afternoon', label: 'Afternoon', startHour: 12 },
  { key: 'evening', label: 'Evening', startHour: 18 },
];

export const PERIOD_HOURS = 6;

export function periodAt(date: Date): PeriodKey {
  return PERIODS[Math.floor(date.getHours() / PERIOD_HOURS)].key;
}

export function periodStartHour(key: PeriodKey): number {
  return PERIODS.find((p) => p.key === key)!.startHour;
}

export type Ring = 'life' | 'college' | 'events';

export function ringFor(item: TimelineItem): Ring {
  switch (item.kind) {
    case 'class':
    case 'exam':
    case 'study':
      return 'college';
    case 'event':
      return 'events';
    default:
      return 'life';
  }
}

/**
 * Angle in degrees (screen coordinates: 0° = right, 90° = down) for a fraction of the period.
 * The period runs from the bottom (90°) through the left (180°) to the top (270°).
 */
export function angleFor(fraction: number): number {
  return 90 + Math.max(0, Math.min(1, fraction)) * 180;
}

export function polar(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
  const a = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

/** SVG arc path along radius `r` from angle a0 to a1 (clockwise on screen). */
export function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const p0 = polar(cx, cy, r, a0);
  const p1 = polar(cx, cy, r, a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  const f = (n: number) => Math.round(n * 100) / 100;
  return `M ${f(p0.x)} ${f(p0.y)} A ${r} ${r} 0 ${large} 1 ${f(p1.x)} ${f(p1.y)}`;
}

/** Same arc traversed the other way (a1 → a0), so text on the lower part of the dial reads upright. */
export function arcPathReversed(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const p0 = polar(cx, cy, r, a1);
  const p1 = polar(cx, cy, r, a0);
  const large = a1 - a0 > 180 ? 1 : 0;
  const f = (n: number) => Math.round(n * 100) / 100;
  return `M ${f(p0.x)} ${f(p0.y)} A ${r} ${r} 0 ${large} 0 ${f(p1.x)} ${f(p1.y)}`;
}

/** Text along arcs centred below this angle reads better reversed (bottom-left of the dial). */
export const REVERSE_TEXT_BELOW_DEG = 165;

/** Fraction (0–1) of the period at which `date` falls; may be outside [0, 1]. */
export function fractionIn(periodStart: Date, date: Date): number {
  return (date.getTime() - periodStart.getTime()) / (PERIOD_HOURS * 3_600_000);
}

export interface ArcItem {
  item: Exclude<TimelineItem, { kind: 'habit' }>;
  ring: Ring;
  a0: number;
  a1: number;
  lane: number;
  lanes: number;
}

/** Items with a duration that touch the period, as angle ranges, with lanes for overlaps within a ring. */
export function arcsForPeriod(items: readonly TimelineItem[], periodStart: Date): ArcItem[] {
  const spans = items
    .filter((i): i is Exclude<TimelineItem, { kind: 'habit' }> => i.kind !== 'habit')
    .map((item) => ({ item, f0: fractionIn(periodStart, item.start), f1: fractionIn(periodStart, item.end) }))
    .filter((s) => s.f1 > 0 && s.f0 < 1);

  const out: ArcItem[] = [];
  for (const ring of ['life', 'college', 'events'] as Ring[]) {
    const inRing = spans.filter((s) => ringFor(s.item) === ring).sort((a, b) => a.f0 - b.f0 || b.f1 - a.f1);
    // Greedy lanes within clusters of overlapping items.
    let cluster: { s: (typeof inRing)[number]; lane: number }[] = [];
    let clusterEnd = -Infinity;
    const flush = () => {
      const lanes = Math.max(1, ...cluster.map((c) => c.lane + 1));
      for (const c of cluster) out.push({ item: c.s.item, ring, a0: angleFor(c.s.f0), a1: angleFor(c.s.f1), lane: c.lane, lanes });
      cluster = [];
    };
    for (const s of inRing) {
      if (s.f0 >= clusterEnd) {
        flush();
        clusterEnd = -Infinity;
      }
      const laneEnds: number[] = [];
      for (const c of cluster) laneEnds[c.lane] = Math.max(laneEnds[c.lane] ?? -Infinity, c.s.f1);
      let lane = 0;
      while (laneEnds[lane] !== undefined && laneEnds[lane] > s.f0) lane++;
      cluster.push({ s, lane });
      clusterEnd = Math.max(clusterEnd, s.f1);
    }
    flush();
  }
  return out;
}

/** Point items (habits) within the period with their angle. */
export function pointsForPeriod(items: readonly TimelineItem[], periodStart: Date) {
  return items
    .filter((i): i is Extract<TimelineItem, { kind: 'habit' }> => i.kind === 'habit')
    .map((item) => ({ item, f: fractionIn(periodStart, item.start) }))
    .filter((p) => p.f >= 0 && p.f <= 1)
    .map((p) => ({ item: p.item, angle: angleFor(p.f) }));
}

/** "Your morning" etc. */
export function periodTitle(key: PeriodKey): string {
  return `Your ${PERIODS.find((p) => p.key === key)!.label.toLowerCase()}`;
}

// ---------- rotating window (minutes since midnight) ----------

export const WINDOW_MIN = PERIOD_HOURS * 60;
export const MAX_START_MIN = 24 * 60 - WINDOW_MIN;
/** Degrees of dial per minute (180° shows 6 h). */
export const DEG_PER_MIN = 180 / WINDOW_MIN;

export const clampStart = (m: number) => Math.max(0, Math.min(MAX_START_MIN, m));
export const snapStart = (m: number, step = 15) => clampStart(Math.round(m / step) * step);

/** Window that puts `date` in the middle of the dial (left, 9 o'clock position), snapped to 15 min. */
export function windowAround(date: Date): number {
  return snapStart(date.getHours() * 60 + date.getMinutes() - WINDOW_MIN / 2);
}

/**
 * Day change for a window start (minutes from the shown day's midnight): +1 once the window's middle
 * passes midnight going forward, −1 going back, else 0.
 */
export function dayShiftFor(startMin: number): -1 | 0 | 1 {
  const mid = startMin + WINDOW_MIN / 2;
  return mid >= 24 * 60 ? 1 : mid < 0 ? -1 : 0;
}

/** Which named period the window is mostly in (by its midpoint). */
export function periodOfWindow(startMin: number): PeriodKey {
  const mid = Math.max(0, Math.min(24 * 60 - 1, startMin + WINDOW_MIN / 2));
  return PERIODS[Math.floor(mid / 60 / PERIOD_HOURS)].key;
}

/**
 * New window start after the finger moves around the dial centre from angle `fromDeg` to `toDeg`
 * (screen degrees). Content follows the finger: clockwise (increasing angle) goes back in time.
 */
export function rotateWindow(startMin: number, fromDeg: number, toDeg: number): number {
  let d = toDeg - fromDeg;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  // Not clamped: past midnight the rotation hook moves to the neighbouring day (see dayShiftFor).
  return startMin - d / DEG_PER_MIN;
}

/** Whole hours and quarter-hour ticks visible in a window, as fractions of the window. */
export function windowMarks(startMin: number) {
  const end = startMin + WINDOW_MIN;
  const hours: { hour: number; f: number }[] = [];
  for (let h = Math.ceil(startMin / 60); h * 60 <= end; h++) hours.push({ hour: h, f: (h * 60 - startMin) / WINDOW_MIN });
  const quarters: { f: number; isHour: boolean }[] = [];
  for (let q = Math.ceil(startMin / 15); q * 15 <= end; q++) quarters.push({ f: (q * 15 - startMin) / WINDOW_MIN, isHour: q % 4 === 0 });
  return { hours, quarters };
}

/** Screen angle (degrees, 0–360) of point (x, y) around centre (cx, cy). */
export function angleOf(cx: number, cy: number, x: number, y: number): number {
  const a = (Math.atan2(y - cy, x - cx) * 180) / Math.PI;
  return a < 0 ? a + 360 : a;
}

// ---------- dial geometry & hit testing (shared by drawing and touch handling) ----------

/** Ring bands as fractions of the outer radius [inner, outer]. */
export const RING_BANDS: Record<Ring, [number, number]> = {
  life: [0.47, 0.605],
  college: [0.625, 0.79],
  events: [0.81, 0.935],
};
export const FACE_FRACTION = 0.44;

/** Dial centre sits at the right edge, vertically centred in its box. */
export function dialGeometry(width: number, height: number) {
  const cx = width - 4;
  const cy = height / 2;
  return { cx, cy, R: Math.min(cx - 6, height / 2 - 6) };
}

/** Is (x, y) — in dial-box coordinates — on the visible half of the dial (where a touch should rotate it)? */
export function isOnDial(width: number, height: number, x: number, y: number): boolean {
  const { cx, cy, R } = dialGeometry(width, height);
  const r = Math.hypot(x - cx, y - cy);
  const a = angleOf(cx, cy, x, y);
  return r <= R + 4 && a >= 85 && a <= 275;
}

/** The item under (x, y) in dial-box coordinates: habit dots first, then arcs (by ring, lane and angle). */
export function hitTest(
  items: readonly TimelineItem[],
  periodStart: Date,
  width: number,
  height: number,
  x: number,
  y: number,
): TimelineItem | null {
  const { cx, cy, R } = dialGeometry(width, height);
  const r = Math.hypot(x - cx, y - cy);
  const a = angleOf(cx, cy, x, y);
  if (a < 85 || a > 275) return null;

  const lifeMid = ((RING_BANDS.life[0] + RING_BANDS.life[1]) / 2) * R;
  for (const p of pointsForPeriod(items, periodStart)) {
    const pos = polar(cx, cy, lifeMid, p.angle);
    if (Math.hypot(x - pos.x, y - pos.y) <= 18) return p.item;
  }
  for (const arc of arcsForPeriod(items, periodStart)) {
    const [fi, fo] = RING_BANDS[arc.ring];
    const laneW = ((fo - fi) * R) / arc.lanes;
    const r0 = fi * R + laneW * arc.lane - 3;
    const r1 = r0 + laneW + 6;
    if (r >= r0 && r <= r1 && a >= arc.a0 - 1.5 && a <= arc.a1 + 1.5) return arc.item;
  }
  return null;
}

// ---------- rigid full-circle dial (rotates as one piece) ----------
//
// The dial content is drawn once around a base time `base` (minutes since midnight) covering a full
// circle = 12 h: from base − 3 h (angle 0°, right) through base (90°, bottom), base + 6 h (270°, top)
// back to base + 9 h (360°). The visible left half shows [start, start + 6 h]; the drawing is rotated by
// (base − start) × DEG_PER_MIN, so any start within ±3 h of base is fully drawn.

export const CONTENT_BEFORE_MIN = 180;
export const CONTENT_SPAN_MIN = 720;

/** Content angle (degrees) of a time `offsetMin` minutes after `base`. */
export const contentAngle = (offsetMin: number) => 90 + offsetMin * DEG_PER_MIN;

/** Rotation (degrees) to show window `startMin` using content drawn at `baseMin`. */
export const rotationFor = (baseMin: number, startMin: number) => (baseMin - startMin) * DEG_PER_MIN;

/** Rebase once the window has drifted this far from the drawn base. */
export const REBASE_MIN = 120;

/** Duration items within the 12-hour content range around `baseDate`, as content angles with lanes per ring. */
export function arcsForContent(items: readonly TimelineItem[], baseDate: Date): ArcItem[] {
  const lo = -CONTENT_BEFORE_MIN;
  const hi = CONTENT_SPAN_MIN - CONTENT_BEFORE_MIN;
  const off = (d: Date) => (d.getTime() - baseDate.getTime()) / 60_000;
  const spans = items
    .filter((i): i is Exclude<TimelineItem, { kind: 'habit' }> => i.kind !== 'habit')
    .map((item) => ({ item, o0: Math.max(lo, off(item.start)), o1: Math.min(hi, off(item.end)) }))
    .filter((s) => s.o1 > s.o0);
  const out: ArcItem[] = [];
  for (const ring of ['life', 'college', 'events'] as Ring[]) {
    const inRing = spans.filter((s) => ringFor(s.item) === ring).sort((a, b) => a.o0 - b.o0 || b.o1 - a.o1);
    let cluster: { s: (typeof inRing)[number]; lane: number }[] = [];
    let clusterEnd = -Infinity;
    const flush = () => {
      const lanes = Math.max(1, ...cluster.map((c) => c.lane + 1));
      for (const c of cluster) out.push({ item: c.s.item, ring, a0: contentAngle(c.s.o0), a1: contentAngle(c.s.o1), lane: c.lane, lanes });
      cluster = [];
    };
    for (const s of inRing) {
      if (s.o0 >= clusterEnd) {
        flush();
        clusterEnd = -Infinity;
      }
      const laneEnds: number[] = [];
      for (const c of cluster) laneEnds[c.lane] = Math.max(laneEnds[c.lane] ?? -Infinity, c.s.o1);
      let lane = 0;
      while (laneEnds[lane] !== undefined && laneEnds[lane] > s.o0) lane++;
      cluster.push({ s, lane });
      clusterEnd = Math.max(clusterEnd, s.o1);
    }
    flush();
  }
  return out;
}

/** Habits within the content range, at content angles. */
export function pointsForContent(items: readonly TimelineItem[], baseDate: Date) {
  return items
    .filter((i): i is Extract<TimelineItem, { kind: 'habit' }> => i.kind === 'habit')
    .map((item) => ({ item, o: (item.start.getTime() - baseDate.getTime()) / 60_000 }))
    .filter((p) => p.o >= -CONTENT_BEFORE_MIN && p.o < CONTENT_SPAN_MIN - CONTENT_BEFORE_MIN)
    .map((p) => ({ item: p.item, angle: contentAngle(p.o) }));
}

/** Hour labels and quarter ticks over the content range (offsets from base, and clock hour/day validity). */
export function contentMarks(baseMin: number) {
  const from = baseMin - CONTENT_BEFORE_MIN;
  const to = from + CONTENT_SPAN_MIN;
  const hours: { hour: number; angle: number; inDay: boolean; dayOffset: number }[] = [];
  for (let h = Math.ceil(from / 60); h * 60 < to; h++) {
    hours.push({ hour: ((h % 24) + 24) % 24, angle: contentAngle(h * 60 - baseMin), inDay: h >= 0 && h <= 24, dayOffset: Math.floor(h / 24) });
  }
  const quarters: { angle: number; isHour: boolean; inDay: boolean }[] = [];
  for (let q = Math.ceil(from / 15); q * 15 < to; q++) quarters.push({ angle: contentAngle(q * 15 - baseMin), isHour: q % 4 === 0, inDay: q >= 0 && q <= 96 });
  return { hours, quarters };
}

/** Label that fits an arc: full title, truncated with "…", or a short form for tiny arcs; '' if nothing fits. */
export function fitLabel(title: string, arcLenPx: number, fontSize: number, shortName?: string): string {
  const charW = fontSize * 0.64; // conservative: Android drops TextPath text that overflows
  const maxChars = Math.floor((arcLenPx - 10) / charW);
  if (maxChars <= 0) return '';
  if (title.length <= maxChars) return title;
  // A known short name (e.g. subject "DSA") beats a heavily truncated title.
  if (shortName && shortName.length <= maxChars && maxChars < title.length * 0.8) return shortName;
  if (maxChars >= 4) return `${title.slice(0, maxChars - 1).trimEnd()}…`;
  // Tiny arc: first word (or initials) cut to fit, no ellipsis.
  const words = title.replace(/^IA\d+:\s*/, '').split(/[\s&/:-]+/).filter(Boolean);
  const initials = words.map((w) => w[0]).join('').toUpperCase();
  const short = words[0] && words[0].length <= maxChars ? words[0] : initials;
  return short.slice(0, maxChars);
}

/** Item under a touch, for the rotated content: the touch angle is un-rotated before matching. */
export function hitTestContent(
  items: readonly TimelineItem[],
  baseDate: Date,
  rotationDeg: number,
  width: number,
  height: number,
  x: number,
  y: number,
): TimelineItem | null {
  const { cx, cy, R } = dialGeometry(width, height);
  const screen = angleOf(cx, cy, x, y);
  if (screen < 85 || screen > 275) return null;
  const r = Math.hypot(x - cx, y - cy);
  const a = (((screen - rotationDeg) % 360) + 360) % 360;
  const lifeMid = ((RING_BANDS.life[0] + RING_BANDS.life[1]) / 2) * R;
  for (const p of pointsForContent(items, baseDate)) {
    const pos = polar(cx, cy, lifeMid, p.angle + rotationDeg);
    if (Math.hypot(x - pos.x, y - pos.y) <= 18) return p.item;
  }
  for (const arc of arcsForContent(items, baseDate)) {
    const [fi, fo] = RING_BANDS[arc.ring];
    const laneW = ((fo - fi) * R) / arc.lanes;
    const r0 = fi * R + laneW * arc.lane - 3;
    if (r >= r0 && r <= r0 + laneW + 6 && a >= arc.a0 - 1.5 && a <= arc.a1 + 1.5) return arc.item;
  }
  return null;
}
