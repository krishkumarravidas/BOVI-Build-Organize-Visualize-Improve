import { byDay, classHistory, dayState, historyStats, monthGrid } from './attendanceHistory';
import type { CollegeState } from './college';
import { emptyCollege } from './college';

// One subject, one class every Monday and Wednesday at 09:00.
function college(extra: Partial<CollegeState> = {}): CollegeState {
  return {
    ...emptyCollege(),
    subjects: [{ id: 'dsa', name: 'Data Structures', short: 'DSA', color: '#3A3A3A' }],
    slots: [
      { id: 'mon', day: 1, start: '09:00', end: '10:00', subjectId: 'dsa' },
      { id: 'wed', day: 3, start: '09:00', end: '10:00', subjectId: 'dsa' },
    ],
    ...extra,
  };
}
const NOW = new Date(2026, 10, 18, 12, 0); // Wed 18 Nov 2026, after the 09:00 class

describe('classHistory', () => {
  it('lists past classes oldest first, with your marks and unmarked ones', () => {
    const c = college({
      attendance: [
        { date: '2026-11-16', key: 's:mon', subjectId: 'dsa', status: 'present' },
        { date: '2026-11-11', key: 's:wed', subjectId: 'dsa', status: 'absent' },
      ],
    });
    const recs = classHistory(c, NOW, 10);
    expect(recs.map((r) => `${r.date}:${r.status}`)).toEqual(['2026-11-09:unmarked', '2026-11-11:absent', '2026-11-16:present', '2026-11-18:unmarked']);
  });

  it('leaves out classes that have not started yet, and cancelled ones', () => {
    const c = college({ changes: [{ id: 'x', kind: 'cancel', date: '2026-11-16', slotId: 'mon' }] });
    const early = new Date(2026, 10, 18, 8, 0);
    const recs = classHistory(c, early, 3);
    expect(recs.map((r) => r.date)).toEqual([]);
  });

  it('fills in portal days as present, absences as absent, and stops at the portal total', () => {
    const c = college({
      attendanceBaseline: { dsa: { present: 3, total: 4, asOf: '2026-11-11', absences: [{ date: '2026-11-04', time: '09:00' }] } },
      attendance: [{ date: '2026-11-16', key: 's:mon', subjectId: 'dsa', status: 'absent' }],
    });
    const recs = classHistory(c, NOW, 40);
    // Portal covers exactly 4 classes back from 11 Nov: 11, 9, 4, 2 Nov. Nothing before.
    expect(recs.filter((r) => r.source === 'portal').map((r) => `${r.date}:${r.status}`)).toEqual([
      '2026-11-02:present',
      '2026-11-04:absent',
      '2026-11-09:present',
      '2026-11-11:present',
    ]);
    expect(recs.find((r) => r.date === '2026-11-16')).toMatchObject({ status: 'absent', source: 'marked' });
    expect(recs.some((r) => r.date < '2026-11-02')).toBe(false);
  });

  it('does not guess present days when the portal lists only some absences', () => {
    const c = college({ attendanceBaseline: { dsa: { present: 2, total: 4, asOf: '2026-11-11', absences: [{ date: '2026-11-04', time: '09:00' }] } } });
    const portal = classHistory(c, NOW, 40).filter((r) => r.source === 'portal');
    expect(portal.map((r) => `${r.date}:${r.status}`)).toEqual(['2026-11-04:absent']);
  });

  it('keeps marks for classes that were removed from the timetable', () => {
    const c = college({ attendance: [{ date: '2026-11-17', key: 's:old-tue', subjectId: 'dsa', status: 'present' }] });
    expect(classHistory(c, NOW, 5).some((r) => r.date === '2026-11-17' && r.status === 'present')).toBe(true);
  });
});

describe('byDay / dayState', () => {
  it('summarises each day', () => {
    const days = byDay([
      { date: '2026-11-16', subjectId: 'a', start: '09:00', status: 'present', source: 'marked' },
      { date: '2026-11-16', subjectId: 'b', start: '10:00', status: 'absent', source: 'marked' },
      { date: '2026-11-17', subjectId: 'a', start: '09:00', status: 'present', source: 'marked' },
      { date: '2026-11-18', subjectId: 'a', start: '09:00', status: 'unmarked', source: 'none' },
    ]);
    expect(dayState(days.get('2026-11-16'))).toBe('mixed');
    expect(dayState(days.get('2026-11-17'))).toBe('present');
    expect(dayState(days.get('2026-11-18'))).toBe('unmarked');
    expect(dayState(days.get('2026-11-19'))).toBe('none');
  });
});

describe('historyStats', () => {
  const rec = (date: string, status: 'present' | 'absent' | 'unmarked') => ({ date, subjectId: 'dsa', start: '09:00', status, source: 'marked' as const });

  it('counts streaks, last absence, month and perfect days', () => {
    const s = historyStats(
      [rec('2026-10-28', 'present'), rec('2026-11-02', 'present'), rec('2026-11-04', 'absent'), rec('2026-11-09', 'present'), rec('2026-11-11', 'present'), rec('2026-11-16', 'present'), rec('2026-11-18', 'unmarked')],
      '2026-11-18',
    );
    expect(s.streak).toBe(3);
    expect(s.longestStreak).toBe(3);
    expect(s.lastAbsent).toBe('2026-11-04');
    expect(s.thisMonth).toEqual({ present: 4, total: 5, percent: 80 });
    expect(s.perfectDaysThisMonth).toBe(4);
    expect(s.unmarked).toBe(1);
  });

  it('finds the most-missed weekday only after 2+ absences', () => {
    const one = historyStats([rec('2026-11-04', 'absent'), rec('2026-11-09', 'present')], '2026-11-18');
    expect(one.mostMissedDay).toBeNull();
    const two = historyStats([rec('2026-11-04', 'absent'), rec('2026-11-11', 'absent'), rec('2026-11-09', 'present'), rec('2026-11-16', 'present')], '2026-11-18');
    expect(two.mostMissedDay).toEqual({ day: 3, absent: 2, total: 2 });
  });

  it('builds a Monday-start weekly trend, oldest first', () => {
    const s = historyStats([rec('2026-11-09', 'present'), rec('2026-11-11', 'absent'), rec('2026-11-16', 'present')], '2026-11-18', 3);
    expect(s.weeks.map((w) => w.start)).toEqual(['2026-11-02', '2026-11-09', '2026-11-16']);
    expect(s.weeks.map((w) => w.percent)).toEqual([null, 50, 100]);
  });
});

describe('monthGrid', () => {
  it('pads to full Monday-first weeks', () => {
    const g = monthGrid(2026, 10); // November 2026 starts on a Sunday
    expect(g[0].slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(g[0][6]).toBe('2026-11-01');
    expect(g.every((w) => w.length === 7)).toBe(true);
    expect(g.flat().filter(Boolean)).toHaveLength(30);
  });
});
