/**
 * Attendance class by class: which days you were present or absent, from your own marks and from the
 * college portal import, plus the stats built on that (streaks, weekly trend, most-missed weekday...).
 *
 * The portal gives totals and absence dates, not present dates. When it lists every absence, past
 * classes up to its `asOf` date count as present (unless listed), walking back from `asOf` only until
 * the portal's own total is reached, so the history never claims more classes than the portal counted.
 * When its absence list is incomplete, only the listed absences are shown (the rest are unknown).
 */
import { resolveDay, type ClassOccurrence, type CollegeState } from './college';
import { addDays, fromDateKey, toDateKey } from './dates';
import type { DateKey } from './types';

export type ClassStatus = 'present' | 'absent' | 'unmarked';

export interface ClassRecord {
  date: DateKey;
  /** Occurrence key (for marking), when the class is still in the timetable. */
  key?: string;
  subjectId: string;
  start: string;
  status: ClassStatus;
  /** Where the status comes from. */
  source: 'marked' | 'portal' | 'none';
  occurrence?: ClassOccurrence;
}

export const HISTORY_DAYS = 150;

/** Every subject class from `days` ago up to now, oldest first. Future and cancelled classes are left out. */
export function classHistory(college: CollegeState, now: Date, days = HISTORY_DAYS): ClassRecord[] {
  const today = toDateKey(now);
  const nowMs = now.getTime();
  const marks = new Map(college.attendance.map((m) => [`${m.date}|${m.key}`, m]));
  const usedMarks = new Set<string>();
  const out: ClassRecord[] = [];

  // Portal: absences per subject+date (several classes on one day can be absent), and how many classes
  // its total still allows us to infer, counted walking back from asOf.
  const absentLeft = new Map<string, number>();
  const portalBudget = new Map<string, number>();
  // Only when the portal lists every absence can the other portal classes be called present.
  const portalComplete = new Set<string>();
  for (const [sid, base] of Object.entries(college.attendanceBaseline ?? {})) {
    portalBudget.set(sid, base.total);
    if ((base.absences?.length ?? 0) >= base.total - base.present) portalComplete.add(sid);
    for (const a of base.absences ?? []) absentLeft.set(`${sid}|${a.date}`, (absentLeft.get(`${sid}|${a.date}`) ?? 0) + 1);
  }

  // Walk newest → oldest so the portal budget is spent from asOf backwards.
  for (let i = 0; i <= days; i++) {
    const date = addDays(today, -i);
    const occs = resolveDay(college, date)
      .filter((o) => o.subject && o.status !== 'cancelled' && o.start.getTime() <= nowMs)
      .sort((a, b) => b.start.getTime() - a.start.getTime());
    for (const o of occs) {
      const sid = o.subject!.id;
      const k = `${date}|${o.key}`;
      const mark = marks.get(k);
      const base = college.attendanceBaseline?.[sid];
      let status: ClassStatus = 'unmarked';
      let source: ClassRecord['source'] = 'none';
      if (mark && (!base || date > base.asOf)) {
        usedMarks.add(k);
        status = mark.status;
        source = 'marked';
      } else if (base && date <= base.asOf) {
        const budget = portalBudget.get(sid) ?? 0;
        if (budget <= 0) continue; // before the portal's counting started
        portalBudget.set(sid, budget - 1);
        const ak = `${sid}|${date}`;
        const left = absentLeft.get(ak) ?? 0;
        if (left === 0 && !portalComplete.has(sid)) continue; // unknown: the portal didn't say which days
        if (left > 0) absentLeft.set(ak, left - 1);
        status = left > 0 ? 'absent' : 'present';
        source = 'portal';
        if (mark) usedMarks.add(k);
      } else if (mark) {
        usedMarks.add(k);
        status = mark.status;
        source = 'marked';
      }
      out.push({ date, key: o.key, subjectId: sid, start: o.startText, status, source, occurrence: o });
    }
  }

  // Marks for classes no longer in the timetable still count (stats count them too).
  const from = addDays(today, -days);
  for (const m of college.attendance) {
    const k = `${m.date}|${m.key}`;
    if (usedMarks.has(k) || !m.subjectId || m.date < from || m.date > today) continue;
    const base = college.attendanceBaseline?.[m.subjectId];
    if (base && m.date <= base.asOf) continue;
    out.push({ date: m.date, subjectId: m.subjectId, start: '', status: m.status, source: 'marked' });
  }

  return out.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
}

export interface DaySummary {
  present: number;
  absent: number;
  unmarked: number;
  records: ClassRecord[];
}

export type DayState = 'present' | 'absent' | 'mixed' | 'unmarked' | 'none';

export function byDay(records: readonly ClassRecord[]): Map<DateKey, DaySummary> {
  const map = new Map<DateKey, DaySummary>();
  for (const r of records) {
    const d = map.get(r.date) ?? { present: 0, absent: 0, unmarked: 0, records: [] };
    d[r.status]++;
    d.records.push(r);
    map.set(r.date, d);
  }
  return map;
}

export function dayState(d: DaySummary | undefined): DayState {
  if (!d) return 'none';
  if (d.absent && d.present) return 'mixed';
  if (d.absent) return 'absent';
  if (d.present) return 'present';
  return 'unmarked';
}

const known = (r: ClassRecord) => r.status !== 'unmarked';
const pct = (p: number, t: number) => (t ? (p / t) * 100 : null);

export interface HistoryStats {
  present: number;
  absent: number;
  unmarked: number;
  /** Classes attended in a row, counting back from the latest known one. */
  streak: number;
  longestStreak: number;
  lastAbsent: DateKey | null;
  /** Weekday (0 = Sun) with the highest absence rate, if you've missed at least 2 classes. */
  mostMissedDay: { day: number; absent: number; total: number } | null;
  /** Days with classes this calendar month where you attended every class. */
  perfectDaysThisMonth: number;
  thisMonth: { present: number; total: number; percent: number | null };
  /** Monday-start weeks, oldest first. */
  weeks: { start: DateKey; present: number; total: number; percent: number | null }[];
}

export function historyStats(records: readonly ClassRecord[], today: DateKey, weeks = 8): HistoryStats {
  const k = records.filter(known);
  const present = k.filter((r) => r.status === 'present').length;
  const absent = k.length - present;

  let streak = 0;
  for (let i = k.length - 1; i >= 0 && k[i].status === 'present'; i--) streak++;
  let longest = 0;
  let run = 0;
  for (const r of k) {
    run = r.status === 'present' ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  const lastAbsent = [...k].reverse().find((r) => r.status === 'absent')?.date ?? null;

  const perDay = Array.from({ length: 7 }, () => ({ absent: 0, total: 0 }));
  for (const r of k) {
    const wd = fromDateKey(r.date).getDay();
    perDay[wd].total++;
    if (r.status === 'absent') perDay[wd].absent++;
  }
  let mostMissedDay: HistoryStats['mostMissedDay'] = null;
  perDay.forEach((d, day) => {
    if (d.absent < 2) return;
    if (!mostMissedDay || d.absent / d.total > mostMissedDay.absent / mostMissedDay.total) mostMissedDay = { day, ...d };
  });

  const month = today.slice(0, 7);
  const monthRecs = k.filter((r) => r.date.startsWith(month));
  const monthPresent = monthRecs.filter((r) => r.status === 'present').length;
  const days = byDay(records.filter((r) => r.date.startsWith(month)));
  let perfect = 0;
  for (const d of days.values()) if (d.present > 0 && d.absent === 0 && d.unmarked === 0) perfect++;

  const mondayOf = (d: DateKey) => addDays(d, -((fromDateKey(d).getDay() + 6) % 7));
  const thisMonday = mondayOf(today);
  const weekList = Array.from({ length: weeks }, (_, i) => {
    const start = addDays(thisMonday, -7 * (weeks - 1 - i));
    const end = addDays(start, 6);
    const w = k.filter((r) => r.date >= start && r.date <= end);
    const p = w.filter((r) => r.status === 'present').length;
    return { start, present: p, total: w.length, percent: pct(p, w.length) };
  });

  return {
    present,
    absent,
    unmarked: records.length - k.length,
    streak,
    longestStreak: longest,
    lastAbsent,
    mostMissedDay,
    perfectDaysThisMonth: perfect,
    thisMonth: { present: monthPresent, total: monthRecs.length, percent: pct(monthPresent, monthRecs.length) },
    weeks: weekList,
  };
}

/** The month grid (Mon-first), with nulls padding the first and last week. */
export function monthGrid(year: number, month: number): (DateKey | null)[][] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const daysIn = new Date(year, month + 1, 0).getDate();
  const cells: (DateKey | null)[] = [...Array(lead).fill(null)];
  for (let d = 1; d <= daysIn; d++) cells.push(toDateKey(new Date(year, month, d)));
  while (cells.length % 7) cells.push(null);
  const rows: (DateKey | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}
