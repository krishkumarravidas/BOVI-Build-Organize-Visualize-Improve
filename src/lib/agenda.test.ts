import { formatEventTime, groupByDay, toAgendaEvent, type AgendaEvent } from './agenda';

const fmt = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min);

const ev = (over: Partial<AgendaEvent> & { start: Date; end: Date }): AgendaEvent => ({
  id: 'e',
  calendarId: 'c',
  title: 'T',
  allDay: false,
  ...over,
});

describe('toAgendaEvent', () => {
  it('defaults the title and trims fields', () => {
    const e = toAgendaEvent({ id: '1', calendarId: 'c', title: '  ', location: ' ', startDate: '2026-11-15T09:00:00', endDate: '2026-11-15T10:00:00' });
    expect(e.title).toBe('(No title)');
    expect(e.location).toBeUndefined();
    expect(e.allDay).toBe(false);
  });

  it('keeps all-day events on their UTC calendar date regardless of timezone', () => {
    // Android: all-day Nov 15 = 2026-11-15T00:00Z to 2026-11-16T00:00Z.
    const e = toAgendaEvent({ id: '1', calendarId: 'c', startDate: '2026-11-15T00:00:00.000Z', endDate: '2026-11-16T00:00:00.000Z', allDay: true });
    expect(e.start).toEqual(at(2026, 11, 15));
    expect(e.end).toEqual(at(2026, 11, 16));
  });
});

describe('groupByDay', () => {
  it('buckets by day, all-day first then by start time', () => {
    const events = [
      ev({ id: 'late', start: at(2026, 11, 15, 15), end: at(2026, 11, 15, 16) }),
      ev({ id: 'early', start: at(2026, 11, 15, 9), end: at(2026, 11, 15, 10) }),
      ev({ id: 'allday', allDay: true, start: at(2026, 11, 15), end: at(2026, 11, 16) }),
      ev({ id: 'next', start: at(2026, 11, 16, 8), end: at(2026, 11, 16, 9) }),
    ];
    const [d0, d1, d2] = groupByDay(events, '2026-11-15', 3);
    expect(d0.events.map((e) => e.id)).toEqual(['allday', 'early', 'late']);
    expect(d1.events.map((e) => e.id)).toEqual(['next']);
    expect(d2.events).toEqual([]);
  });

  it('shows multi-day events on each day, and does not leak an event ending exactly at midnight', () => {
    const trip = ev({ id: 'trip', start: at(2026, 11, 15, 20), end: at(2026, 11, 17, 8) });
    const endsAtMidnight = ev({ id: 'm', start: at(2026, 11, 15, 22), end: at(2026, 11, 16) });
    const days = groupByDay([trip, endsAtMidnight], '2026-11-15', 3);
    expect(days.map((d) => d.events.map((e) => e.id))).toEqual([['trip', 'm'], ['trip'], ['trip']]);
  });

  it('places instant events by their start time', () => {
    const instant = ev({ id: 'i', start: at(2026, 11, 15, 12), end: at(2026, 11, 15, 12) });
    expect(groupByDay([instant], '2026-11-15', 1)[0].events).toHaveLength(1);
  });
});

describe('formatEventTime', () => {
  it('formats the common cases', () => {
    const day = '2026-11-15';
    expect(formatEventTime(ev({ allDay: true, start: at(2026, 11, 15), end: at(2026, 11, 16) }), day, fmt)).toBe('All day');
    expect(formatEventTime(ev({ start: at(2026, 11, 15, 9), end: at(2026, 11, 15, 10, 30) }), day, fmt)).toBe('09:00 – 10:30');
    expect(formatEventTime(ev({ start: at(2026, 11, 15, 22), end: at(2026, 11, 16, 2) }), day, fmt)).toBe('From 22:00');
    expect(formatEventTime(ev({ start: at(2026, 11, 14, 22), end: at(2026, 11, 15, 2) }), day, fmt)).toBe('Until 02:00');
    expect(formatEventTime(ev({ start: at(2026, 11, 14, 22), end: at(2026, 11, 16, 2) }), day, fmt)).toBe('All day');
    expect(formatEventTime(ev({ start: at(2026, 11, 15, 12), end: at(2026, 11, 15, 12) }), day, fmt)).toBe('12:00');
  });
});
