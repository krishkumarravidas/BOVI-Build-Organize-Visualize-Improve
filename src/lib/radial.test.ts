import { angleFor, arcPath, arcPathReversed, arcsForPeriod, fractionIn, periodAt, periodTitle, pointsForPeriod, polar, ringFor } from './radial';
import type { TimelineItem } from './timeline';

const at = (h: number, m = 0) => new Date(2026, 10, 16, h, m);
const morning = at(6);
const cls = (key: string, s: Date, e: Date): TimelineItem => ({ kind: 'class', key, occurrenceKey: key, title: key, start: s, end: e, room: 'R', changed: false, conflict: false });
const ev = (key: string, s: Date, e: Date): TimelineItem => ({ kind: 'event', key, title: key, start: s, end: e, conflict: false });

describe('radial geometry', () => {
  it('maps the period from bottom (90°) via left (180°) to top (270°)', () => {
    expect(angleFor(0)).toBe(90);
    expect(angleFor(0.5)).toBe(180);
    expect(angleFor(1)).toBe(270);
    expect(angleFor(2)).toBe(270); // clamped
    const p = polar(100, 100, 50, 180);
    expect([Math.round(p.x), Math.round(p.y)]).toEqual([50, 100]);
  });

  it('builds clockwise SVG arcs', () => {
    expect(arcPath(100, 100, 50, 90, 180)).toBe('M 100 150 A 50 50 0 0 1 50 100');
    expect(arcPathReversed(100, 100, 50, 90, 180)).toBe('M 50 100 A 50 50 0 0 0 100 150');
  });

  it('picks the period and title from the time of day', () => {
    expect(periodAt(at(7, 15))).toBe('morning');
    expect(periodAt(at(13))).toBe('afternoon');
    expect(periodAt(at(23))).toBe('evening');
    expect(periodAt(at(2))).toBe('night');
    expect(periodTitle('morning')).toBe('Your morning');
    expect(fractionIn(morning, at(9))).toBe(0.5);
  });
});

describe('arcsForPeriod', () => {
  it('converts items to angles, clips to the period, and assigns rings', () => {
    const arcs = arcsForPeriod([cls('dsa', at(8, 30), at(9, 30)), cls('late', at(11), at(13)), ev('trip', at(5), at(7)), cls('pm', at(14), at(15))], morning);
    const by = Object.fromEntries(arcs.map((a) => [a.item.key, [a.ring, a.a0, a.a1]]));
    expect(by.dsa).toEqual(['college', 90 + (2.5 / 6) * 180, 90 + (3.5 / 6) * 180]);
    expect(by.late).toEqual(['college', 90 + (5 / 6) * 180, 270]); // clipped at period end
    expect(by.trip).toEqual(['events', 90, 90 + (1 / 6) * 180]); // clipped at period start
    expect(by.pm).toBeUndefined();
  });

  it('splits overlapping items in the same ring into lanes', () => {
    const arcs = arcsForPeriod([cls('a', at(9), at(11)), cls('b', at(10), at(11, 30)), ev('c', at(10), at(11))], morning);
    const by = Object.fromEntries(arcs.map((a) => [a.item.key, [a.lane, a.lanes]]));
    expect(by).toEqual({ a: [0, 2], b: [1, 2], c: [0, 1] });
  });

  it('places habits as points and maps kinds to rings', () => {
    const habit: TimelineItem = { kind: 'habit', key: 'h', habitId: 'h', title: 'Read', start: at(9), done: false };
    expect(pointsForPeriod([habit], morning)).toEqual([{ item: habit, angle: 180 }]);
    expect(pointsForPeriod([habit], at(12))).toEqual([]);
    expect(ringFor(habit)).toBe('life');
  });
});

describe('rotating window', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const R = require('./radial') as typeof import('./radial');
  /* eslint-enable @typescript-eslint/no-require-imports */

  it('centres now on the dial, clamped to the day', () => {
    expect(R.windowAround(new Date(2026, 10, 16, 10, 5))).toBe(7 * 60); // 07:00–13:00, 10:00 in the middle
    expect(R.windowAround(new Date(2026, 10, 16, 1, 0))).toBe(0);
    expect(R.windowAround(new Date(2026, 10, 16, 23, 30))).toBe(18 * 60);
  });

  it('rotates with the finger: clockwise goes back, anticlockwise forward, wrapping across 0°/360°', () => {
    expect(R.rotateWindow(600, 180, 210)).toBe(600 - 60); // 30° clockwise = 1 h earlier
    expect(R.rotateWindow(600, 210, 180)).toBe(660);
    expect(R.rotateWindow(600, 350, 10)).toBe(600 - 40); // crosses 360 → +20°
    // No clamping: past midnight the dial carries on into the neighbouring day.
    expect(R.rotateWindow(10, 180, 270)).toBe(-170);
    expect(R.rotateWindow(1070, 270, 180)).toBe(1250);
  });

  it('snaps and names windows', () => {
    expect(R.snapStart(437)).toBe(435);
    expect(R.snapStart(-20)).toBe(0);
    expect(R.periodOfWindow(7 * 60)).toBe('morning'); // midpoint 10:00
    expect(R.periodOfWindow(10 * 60)).toBe('afternoon'); // midpoint 13:00
    expect(R.periodOfWindow(18 * 60)).toBe('evening');
  });

  it('lists hour labels and quarter ticks for fractional windows', () => {
    const m = R.windowMarks(7 * 60 + 30); // 07:30–13:30
    expect(m.hours.map((h) => h.hour)).toEqual([8, 9, 10, 11, 12, 13]);
    expect(m.hours[0].f).toBeCloseTo(30 / 360);
    expect(m.quarters).toHaveLength(25);
    expect(m.quarters.filter((q) => q.isHour)).toHaveLength(6);
  });

  it('measures touch angles around the centre', () => {
    expect(R.angleOf(100, 100, 50, 100)).toBe(180);
    expect(R.angleOf(100, 100, 100, 150)).toBe(90);
    expect(R.angleOf(100, 100, 100, 50)).toBe(270);
  });
});

describe('dial hit testing', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const R = require('./radial') as typeof import('./radial');
  /* eslint-enable @typescript-eslint/no-require-imports */
  const W = 390, H = 472;
  const g = R.dialGeometry(W, H);
  const morning = new Date(2026, 10, 16, 6);
  const at = (h: number, m = 0) => new Date(2026, 10, 16, h, m);
  const pointAt = (ring: 'life' | 'college' | 'events', hour: number) => {
    const [fi, fo] = R.RING_BANDS[ring];
    return R.polar(g.cx, g.cy, ((fi + fo) / 2) * g.R, R.angleFor((hour - 6) / 6));
  };
  const dsa: TimelineItem = { kind: 'class', key: 'dsa', occurrenceKey: 'dsa', title: 'DSA', start: at(8, 30), end: at(9, 25), room: 'R', changed: false, conflict: false };
  const ev: TimelineItem = { kind: 'event', key: 'ev', title: 'Call', start: at(8, 30), end: at(9, 25), conflict: false };
  const habit: TimelineItem = { kind: 'habit', key: 'h', habitId: 'h', title: 'Read', start: at(10), done: false };

  it('knows which touches are on the dial', () => {
    const p = pointAt('college', 9);
    expect(R.isOnDial(W, H, p.x, p.y)).toBe(true);
    expect(R.isOnDial(W, H, 10, 10)).toBe(false); // top-left corner, outside the rings
    expect(R.isOnDial(W, H, g.cx + 2, g.cy)).toBe(false); // hidden right half
  });

  it('finds the arc under the finger by ring and time', () => {
    const items = [dsa, ev, habit];
    const p = pointAt('college', 9);
    expect(R.hitTest(items, morning, W, H, p.x, p.y)?.key).toBe('dsa');
    const e = pointAt('events', 9);
    expect(R.hitTest(items, morning, W, H, e.x, e.y)?.key).toBe('ev');
    const miss = pointAt('college', 11);
    expect(R.hitTest(items, morning, W, H, miss.x, miss.y)).toBeNull();
  });

  it('finds habit dots on the LIFE ring', () => {
    const p = pointAt('life', 10);
    expect(R.hitTest([habit], morning, W, H, p.x + 5, p.y - 5)?.key).toBe('h');
  });
});

describe('rigid content dial', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const R = require('./radial') as typeof import('./radial');
  /* eslint-enable @typescript-eslint/no-require-imports */
  const at = (h: number, m = 0) => new Date(2026, 10, 16, h, m);
  const base = at(7); // content covers 04:00–16:00
  const cls = (key: string, s: Date, e: Date): TimelineItem => ({ kind: 'class', key, occurrenceKey: key, title: key, start: s, end: e, room: 'R', changed: false, conflict: false });

  it('maps a 12 h range around the base to a full circle and rotates by the window offset', () => {
    expect(R.contentAngle(-180)).toBe(0);
    expect(R.contentAngle(0)).toBe(90);
    expect(R.contentAngle(360)).toBe(270);
    expect(R.contentAngle(540)).toBe(360);
    expect(R.rotationFor(420, 480)).toBe(-30); // window 1 h later → content turns 30° anticlockwise
  });

  it('keeps arcs whole (no clipping at the visible edge) and clips only at the content range', () => {
    const arcs = R.arcsForContent([cls('dsa', at(8, 30), at(9, 25)), cls('late', at(14, 20), at(16, 10)), cls('early', at(3), at(5))], base);
    const by = Object.fromEntries(arcs.map((a) => [a.item.key, [a.a0, a.a1]]));
    expect(by.dsa).toEqual([90 + 90 * 0.5, 90 + 145 * 0.5]);
    expect(by.late).toEqual([90 + 440 * 0.5, 360]); // runs past 16:00 → clipped at the content edge
    expect(by.early).toEqual([0, 90 - 120 * 0.5]);
  });

  it('lists hour marks across the content, flagging hours outside the day', () => {
    const m = R.contentMarks(60); // content 22:00 (prev day) → 10:00
    expect(m.hours.slice(0, 3).map((h) => [h.hour, h.inDay])).toEqual([[22, false], [23, false], [0, true]]);
    expect(m.quarters).toHaveLength(48);
  });

  it('fits labels conservatively, with short forms for tiny arcs', () => {
    expect(R.fitLabel('Societal Project', 200, 12)).toBe('Societal Project');
    expect(R.fitLabel('Data Structures & Algorithms', 100, 12)).toBe('Data Struc…');
    expect(R.fitLabel('Digital Design & Computer Org.', 34, 12)).toBe('DDC');
    expect(R.fitLabel('Gym', 40, 12)).toBe('Gym');
    expect(R.fitLabel('Gym', 30, 12)).toBe('G');
    expect(R.fitLabel('Anything', 8, 12)).toBe('');
    expect(R.fitLabel('Data Structures & Algorithms', 60, 12, 'DSA')).toBe('DSA');
    expect(R.fitLabel('Data Structures & Algorithms', 400, 12, 'DSA')).toBe('Data Structures & Algorithms');
  });

  it('hit-tests through the rotation', () => {
    const W = 390, H = 472;
    const g = R.dialGeometry(W, H);
    const item = cls('dsa', at(8, 30), at(9, 25));
    const mid = ((R.RING_BANDS.college[0] + R.RING_BANDS.college[1]) / 2) * g.R;
    // Window 08:00–14:00 (start 480) with content drawn at base 07:00 → rotation −30°.
    const rot = R.rotationFor(420, 480);
    const screenAngle = R.contentAngle(9 * 60 - 420) + rot; // 09:00 on screen
    const p = R.polar(g.cx, g.cy, mid, screenAngle);
    expect(R.hitTestContent([item], base, rot, W, H, p.x, p.y)?.key).toBe('dsa');
    const miss = R.polar(g.cx, g.cy, mid, screenAngle + 40);
    expect(R.hitTestContent([item], base, rot, W, H, miss.x, miss.y)).toBeNull();
  });
});
