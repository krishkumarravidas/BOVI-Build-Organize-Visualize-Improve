import { formatDuration, limitStatus, summarizeUsage } from './screentime';

const row = (label: string, min: number) => ({ packageName: label.toLowerCase(), label, foregroundMs: min * 60_000 });

describe('formatDuration', () => {
  it.each([
    [0, '<1m'],
    [59_000, '<1m'],
    [45 * 60_000, '45m'],
    [60 * 60_000, '1h'],
    [125 * 60_000, '2h 5m'],
    [-5, '<1m'],
  ])('%p ms -> %p', (ms, out) => expect(formatDuration(ms)).toBe(out));
});

describe('summarizeUsage', () => {
  it('keeps the top apps and folds the rest into "other"', () => {
    const s = summarizeUsage([row('A', 10), row('B', 50), row('C', 5), row('D', 30)], 2);
    expect(s.top.map((r) => r.label)).toEqual(['B', 'D']);
    expect(s.totalMs).toBe(95 * 60_000);
    expect(s.otherMs).toBe(15 * 60_000);
    expect(s.otherCount).toBe(2);
  });

  it('ignores zero rows and handles empty input', () => {
    expect(summarizeUsage([row('Z', 0)])).toEqual({ totalMs: 0, top: [], otherMs: 0, otherCount: 0 });
  });
});

describe('limitStatus', () => {
  it('is null without a limit', () => {
    expect(limitStatus(1000, null)).toBeNull();
    expect(limitStatus(1000, 0)).toBeNull();
  });

  it('reports progress and overage', () => {
    expect(limitStatus(30 * 60_000, 60)).toEqual({ ratio: 0.5, over: false, remainingMs: 30 * 60_000 });
    expect(limitStatus(90 * 60_000, 60)).toMatchObject({ over: true, remainingMs: 0, ratio: 1.5 });
  });
});
