import { dateKeyAsDate, formatDateKey, formatTime, parseHHMM, timeAsDate, toDateKey, toHHMM } from './timeFormat';

describe('timeFormat', () => {
  it('parses H:mm and HH:mm, rejects junk', () => {
    expect(parseHHMM('08:30')).toEqual({ h: 8, m: 30 });
    expect(parseHHMM('8:05')).toEqual({ h: 8, m: 5 });
    expect(parseHHMM('23:59')).toEqual({ h: 23, m: 59 });
    expect(parseHHMM('24:00')).toBeNull();
    expect(parseHHMM('8.30')).toBeNull();
    expect(parseHHMM('')).toBeNull();
  });

  it('stores picked times as zero-padded 24-hour HH:mm', () => {
    expect(toHHMM(new Date(2026, 10, 23, 7, 5))).toBe('07:05');
    expect(toHHMM(new Date(2026, 10, 23, 21, 40))).toBe('21:40');
  });

  it('formats for 12- and 24-hour clocks', () => {
    expect(formatTime('08:30', true)).toBe('8:30 am');
    expect(formatTime('00:15', true)).toBe('12:15 am');
    expect(formatTime('12:00', true)).toBe('12:00 pm');
    expect(formatTime('21:40', true)).toBe('9:40 pm');
    expect(formatTime('8:30', false)).toBe('08:30');
    expect(formatTime('later', true)).toBe('later');
  });

  it('opens the time picker at the current value, else the fallback', () => {
    const now = new Date(2026, 10, 23, 15, 0);
    const a = timeAsDate('08:30', '09:00', now);
    expect([a.getHours(), a.getMinutes(), a.getDate()]).toEqual([8, 30, 23]);
    const b = timeAsDate('', '10:15', now);
    expect([b.getHours(), b.getMinutes()]).toEqual([10, 15]);
  });

  it('opens the date picker at the current value, else today, and round-trips the key', () => {
    const now = new Date(2026, 10, 23, 15, 0);
    expect(toDateKey(dateKeyAsDate('2026-12-01', now))).toBe('2026-12-01');
    expect(toDateKey(dateKeyAsDate('', now))).toBe('2026-11-23');
    expect(toDateKey(dateKeyAsDate('2026-02-30', now))).toBe('2026-11-23');
  });

  it('labels dates and leaves non-dates alone', () => {
    expect(formatDateKey('2026-11-23', 'en-GB')).toContain('23');
    expect(formatDateKey('2026-11-23', 'en-GB')).toContain('2026');
    expect(formatDateKey('soon')).toBe('soon');
  });
});
