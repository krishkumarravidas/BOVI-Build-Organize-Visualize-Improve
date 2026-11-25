import { hourLabel, usageLevel, windowUsage, type HourUsage } from './screentime';

const app = (packageName: string, min: number) => ({ packageName, label: packageName, foregroundMs: min * 60_000 });
const day: HourUsage[] = Array.from({ length: 24 }, () => ({ minutes: 0, top: [] }));
day[9] = { minutes: 38, top: [app('Instagram', 21), app('YouTube', 9)] };
day[10] = { minutes: 12, top: [app('WhatsApp', 8), app('Instagram', 4)] };
day[11] = { minutes: 20, top: [app('YouTube', 20)] };

describe('usageLevel', () => {
  it('buckets minutes per hour', () => {
    expect([0, 5, 14, 15, 29, 30, 60].map(usageLevel)).toEqual(['none', 'light', 'light', 'medium', 'medium', 'heavy', 'heavy']);
  });
});

describe('windowUsage', () => {
  it('totals the window and finds the busiest hour and top apps', () => {
    const w = windowUsage(day, 6, 6);
    expect(w.hours.map((h) => h.hour)).toEqual([6, 7, 8, 9, 10, 11]);
    expect(w.totalMin).toBe(70);
    expect(w.busiest?.hour).toBe(9);
    expect(w.heavyHours).toBe(1);
    expect(w.topApps.map((a) => a.label)).toEqual(['YouTube', 'Instagram', 'WhatsApp']);
    expect(Math.round(w.topApps[0].foregroundMs / 60_000)).toBe(29);
  });

  it('leaves out hours outside the day (windows that cross midnight)', () => {
    const w = windowUsage(day, 21, 6);
    expect(w.hours.map((h) => h.hour)).toEqual([21, 22, 23]);
    expect(windowUsage(day, -3, 6).hours.map((h) => h.hour)).toEqual([0, 1, 2]);
  });

  it('has no busiest hour when nothing was used', () => {
    const w = windowUsage(day, 0, 6);
    expect(w.totalMin).toBe(0);
    expect(w.busiest).toBeNull();
    expect(w.topApps).toEqual([]);
  });
});

describe('hourLabel', () => {
  it('formats 12-hour labels', () => {
    expect([0, 9, 12, 13, 23, 24].map(hourLabel)).toEqual(['12 AM', '9 AM', '12 PM', '1 PM', '11 PM', '12 AM']);
  });
});
