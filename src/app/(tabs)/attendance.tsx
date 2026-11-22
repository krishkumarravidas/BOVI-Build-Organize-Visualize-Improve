import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AttendanceButtons } from '@/components/AttendanceButtons';
import { AttendanceRing, HistoryDots, MonthCalendar, StatTile, TargetBar, TrendBars, dayName } from '@/components/AttendanceViews';
import { Card, Chip, ChipRow, EmptyText, KeyboardScroll, ListRow, SectionTitle, shortDate } from '@/components/ui';
import { useCollege } from '@/hooks/useCollege';
import { useTheme } from '@/hooks/useTheme';
import { HISTORY_DAYS, byDay, classHistory, historyStats } from '@/lib/attendanceHistory';
import { resolveDay } from '@/lib/college';
import { attendanceBySubject, attendanceFor, attendanceStats, semesterOutlook, unmarkedClasses } from '@/lib/collegeStats';
import { addDays, toDateKey } from '@/lib/dates';
import type { DateKey } from '@/lib/types';

const TARGETS = [65, 75, 80, 85];
const STATUS_TEXT = { present: 'Present', absent: 'Absent', unmarked: 'Not marked' } as const;

export default function AttendanceScreen() {
  const theme = useTheme();
  const c = useCollege();
  const { college } = c;
  const [now] = useState(() => new Date());
  const today = toDateKey(now);
  const target = college.attendanceTarget;
  const { bySubject, overall } = attendanceBySubject(college);
  const unmarked = unmarkedClasses(college, today, now);
  const pct = (p: number | null) => (p === null ? '—' : `${Math.round(p)}%`);
  const synced = college.attendanceSyncedAt;

  const [filter, setFilter] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [selected, setSelected] = useState<DateKey | null>(today);
  const [ym, setYm] = useState(() => ({ y: now.getFullYear(), m: now.getMonth() }));

  // React Compiler memoizes these.
  const history = classHistory(college, now);
  const shown = filter ? history.filter((r) => r.subjectId === filter) : history;
  const days = byDay(shown);
  const stats = historyStats(shown, today);

  // Future days in the visible month that have (filtered) classes.
  const upcoming = new Set<DateKey>();
  {
    const last = toDateKey(new Date(ym.y, ym.m + 1, 0));
    for (let d = addDays(today, 1); d <= last; d = addDays(d, 1)) {
      if (resolveDay(college, d).some((o) => o.subject && o.status !== 'cancelled' && (!filter || o.subject.id === filter))) upcoming.add(d);
    }
  }

  // Headline numbers for the current filter (same maths as the subject rows).
  const head = filter ? bySubject.find((s) => s.subject.id === filter) : null;
  const headStats = head ?? { ...overall, subject: null, remaining: null, asOf: null };
  const overallSkip = attendanceStats(headStats.present, headStats.total, target);
  const low = headStats.percent !== null && headStats.percent < target;

  const earliest = toDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - HISTORY_DAYS));
  const canGoBack = `${ym.y}-${String(ym.m + 1).padStart(2, '0')}` > earliest.slice(0, 7);
  const sel = selected ? days.get(selected) : undefined;
  const selFutureClasses = selected && selected > today ? resolveDay(college, selected).filter((o) => o.subject && o.status !== 'cancelled' && (!filter || o.subject.id === filter)) : [];
  const subjectOf = (id: string) => college.subjects.find((s) => s.id === id);

  return (
    <KeyboardScroll style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      {college.subjects.length > 1 ? (
        <ChipRow>
          <Chip label="All subjects" selected={filter === null} onPress={() => setFilter(null)} />
          {college.subjects.map((s) => (
            <Chip key={s.id} label={s.short || s.name} color={s.color} selected={filter === s.id} onPress={() => setFilter(filter === s.id ? null : s.id)} />
          ))}
        </ChipRow>
      ) : null}

      {/* Headline */}
      <Card style={styles.hero}>
        <AttendanceRing percent={headStats.percent} target={target} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[styles.heroTitle, { color: theme.text }]} numberOfLines={2}>
            {head ? head.subject.name : 'Overall'}
          </Text>
          <Text style={{ color: theme.muted }}>
            {headStats.total ? `${headStats.present} present · ${headStats.total - headStats.present} absent` : 'Nothing marked yet'}
          </Text>
          {headStats.total ? (
            <Text style={{ color: low ? theme.danger : theme.text, fontWeight: '600' }}>
              {low
                ? `Attend the next ${overallSkip.mustAttend === Infinity ? 'all' : overallSkip.mustAttend} to get back to ${target}%`
                : overallSkip.canSkip > 0
                  ? `You can miss ${overallSkip.canSkip} and stay at ${target}%+`
                  : 'Right on the line: don’t miss the next one'}
            </Text>
          ) : null}
        </View>
      </Card>
      <Text style={{ color: theme.muted, fontSize: 12, marginTop: -4 }}>
        {synced ? `From the college portal as of ${shortDate(synced)}, plus classes you’ve marked since.` : 'From the classes you’ve marked in BOVI.'}
      </Text>

      {/* Quick stats */}
      <View style={styles.tiles}>
        <StatTile label="Streak" value={`${stats.streak} ${stats.streak === 1 ? 'class' : 'classes'}`} detail={`in a row · best ${stats.longestStreak}`} />
        <StatTile
          label="This month"
          value={pct(stats.thisMonth.percent)}
          tone={stats.thisMonth.percent !== null && stats.thisMonth.percent < target ? 'danger' : undefined}
          detail={stats.thisMonth.total ? `${stats.thisMonth.present} of ${stats.thisMonth.total} classes` : 'No classes yet'}
        />
        <StatTile
          label="Most missed"
          value={stats.mostMissedDay ? dayName(stats.mostMissedDay.day).slice(0, 3) : '—'}
          detail={stats.mostMissedDay ? `${stats.mostMissedDay.absent} of ${stats.mostMissedDay.total} missed` : 'No pattern yet'}
        />
        <StatTile label="Perfect days" value={String(stats.perfectDaysThisMonth)} detail={stats.lastAbsent ? `last absent ${shortDate(stats.lastAbsent)}` : 'no absences yet'} />
      </View>

      {/* Calendar */}
      <SectionTitle>Day by day</SectionTitle>
      <Card style={{ gap: 12 }}>
        <MonthCalendar
          year={ym.y}
          month={ym.m}
          days={days}
          upcoming={upcoming}
          today={today}
          selected={selected}
          onSelect={(d) => setSelected(d === selected ? null : d)}
          canGoBack={canGoBack}
          onMonth={(delta) => setYm(({ y, m }) => ({ y: m + delta < 0 ? y - 1 : m + delta > 11 ? y + 1 : y, m: (m + delta + 12) % 12 }))}
        />
        {selected ? (
          <View style={[styles.dayPanel, { borderTopColor: theme.border }]}>
            <Text style={[styles.dayTitle, { color: theme.text }]}>{shortDate(selected)}</Text>
            {sel?.records.length ? (
              sel.records.map((r, i) => {
                const s = subjectOf(r.subjectId);
                const editable = r.source !== 'portal' && !!r.occurrence;
                return (
                  <View key={`${r.key ?? i}`} style={styles.dayRow}>
                    <View style={[styles.subjectDot, { backgroundColor: s?.color ?? theme.muted }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.text, fontWeight: '600' }} numberOfLines={1}>
                        {s?.short || s?.name || 'Class'}
                        {r.start ? <Text style={{ color: theme.muted, fontWeight: '400' }}>{`  ${r.start}`}</Text> : null}
                      </Text>
                      <Text style={{ color: r.status === 'absent' ? theme.danger : theme.muted, fontSize: 13 }}>
                        {STATUS_TEXT[r.status]}
                        {r.source === 'portal' ? ' · from the portal' : ''}
                      </Text>
                    </View>
                    {editable ? (
                      <AttendanceButtons label={`${s?.short ?? 'Class'} ${shortDate(selected)}`} value={attendanceFor(college, r.date, r.key!)} onChange={(v) => c.markAttendance(r.occurrence!, v)} />
                    ) : null}
                  </View>
                );
              })
            ) : selFutureClasses.length ? (
              <Text style={{ color: theme.muted }}>
                {selFutureClasses.length} {selFutureClasses.length === 1 ? 'class' : 'classes'} coming up: {selFutureClasses.map((o) => `${o.subject!.short || o.subject!.name} ${o.startText}`).join(', ')}
              </Text>
            ) : (
              <Text style={{ color: theme.muted }}>No classes{filter ? ' for this subject' : ''} this day.</Text>
            )}
          </View>
        ) : null}
      </Card>

      {/* Trend */}
      <SectionTitle>Last 8 weeks</SectionTitle>
      <Card>
        <TrendBars key={filter ?? 'all'} weeks={stats.weeks} target={target} />
      </Card>

      <ListRow title="Update from portal" subtitle={synced ? `Last synced ${shortDate(synced)}` : 'Paste or open the portal attendance file'} color={theme.primary} onPress={() => router.push('/college/attendance-import')} />

      <SectionTitle>Minimum required</SectionTitle>
      <ChipRow>
        {TARGETS.map((t) => (
          <Chip key={t} label={`${t}%`} selected={target === t} onPress={() => c.setAttendanceTarget(t)} />
        ))}
      </ChipRow>

      {/* Subjects */}
      <SectionTitle>By subject</SectionTitle>
      {bySubject.map(({ subject, percent, present, total, canSkip, mustAttend, remaining }) => {
        const isLow = percent !== null && percent < target;
        const outlook = remaining !== null && total > 0 ? semesterOutlook(present, total, remaining, target) : null;
        const recs = history.filter((r) => r.subjectId === subject.id);
        const last = recs.slice(-12).map((r) => r.status);
        const absences = recs.filter((r) => r.status === 'absent').reverse();
        const expanded = open === subject.id;
        return (
          <Pressable
            key={subject.id}
            onPress={() => setOpen(expanded ? null : subject.id)}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            accessibilityHint="Shows absences and details"
            style={[styles.row, { backgroundColor: theme.surface, borderColor: isLow ? theme.danger : theme.border }]}
          >
            <View style={styles.titleRow}>
              <View style={[styles.subjectDot, { backgroundColor: subject.color }]} />
              <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                {subject.name}
              </Text>
              <Text style={[styles.pct, { color: isLow ? theme.danger : theme.text }]}>{pct(percent)}</Text>
            </View>
            <TargetBar percent={percent} target={target} color={subject.color} />
            <Text style={{ color: theme.muted }}>
              {total === 0
                ? 'Not marked yet'
                : `${present}/${total} · ${isLow ? `attend the next ${mustAttend === Infinity ? 'all' : mustAttend} to reach ${target}%` : canSkip > 0 ? `can miss ${canSkip}` : 'on the line, don’t miss the next one'}`}
            </Text>
            {outlook ? (
              <Text style={{ color: outlook.canMissOfRemaining === null ? theme.danger : theme.muted, fontSize: 13 }}>
                {remaining} classes left ·{' '}
                {outlook.canMissOfRemaining === null
                  ? `can’t reach ${target}% this sem (best ${Math.round(outlook.bestFinal)}%)`
                  : outlook.canMissOfRemaining === 0
                    ? `attend all of them to end at ${target}%+`
                    : `can miss ${outlook.canMissOfRemaining} of them and still end at ${target}%+`}
              </Text>
            ) : null}
            {last.length ? (
              <View style={{ gap: 4 }}>
                <Text style={{ color: theme.muted, fontSize: 12 }}>Last {last.length} classes</Text>
                <HistoryDots statuses={last} />
              </View>
            ) : null}
            {expanded ? (
              <View style={{ marginTop: 4, gap: 2 }}>
                <Text style={{ color: theme.text, fontWeight: '600', fontSize: 13 }}>{absences.length ? `Absent (${absences.length})` : 'No absences recorded'}</Text>
                {absences.slice(0, 30).map((a, i) => (
                  <Text key={`${a.date}-${i}`} style={{ color: theme.muted, fontSize: 13 }}>
                    {shortDate(a.date)}
                    {a.start ? ` · ${a.start}` : ''}
                    {a.source === 'portal' ? ' · portal' : ''}
                  </Text>
                ))}
              </View>
            ) : null}
          </Pressable>
        );
      })}

      <SectionTitle>{`To mark (last 7 days) · ${unmarked.length}`}</SectionTitle>
      {unmarked.length === 0 ? <EmptyText>All caught up.</EmptyText> : null}
      {unmarked.map((o) => (
        <View key={`${o.date}:${o.key}`} style={[styles.markRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
              {o.subject?.short ?? o.title}
            </Text>
            <Text style={{ color: theme.muted }}>
              {shortDate(o.date)} · {o.startText}
            </Text>
          </View>
          <AttendanceButtons label={`${o.title} ${shortDate(o.date)}`} value={attendanceFor(college, o.date, o.key)} onChange={(v) => c.markAttendance(o, v)} />
        </View>
      ))}
      <EmptyText>Only subject classes count. Cancelled classes are ignored.</EmptyText>
    </KeyboardScroll>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  heroTitle: { fontSize: 18, fontWeight: '700' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  dayPanel: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, gap: 10 },
  dayTitle: { fontSize: 15, fontWeight: '700' },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  subjectDot: { width: 10, height: 10, borderRadius: 5 },
  row: { gap: 8, padding: 14, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 16, fontWeight: '600', flexShrink: 1, flex: 1 },
  pct: { fontSize: 16, fontWeight: '800' },
  markRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
});
