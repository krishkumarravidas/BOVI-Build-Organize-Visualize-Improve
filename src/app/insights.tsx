import { StyleSheet, Text, View } from 'react-native';

import { Card, KeyboardScroll, ScreenHeader, SectionTitle } from '@/components/ui';
import { useCollege } from '@/hooks/useCollege';
import { useHabits } from '@/hooks/useHabits';
import { useProjects } from '@/hooks/useProjects';
import { useScreenTime } from '@/hooks/useScreenTime';
import { useTheme } from '@/hooks/useTheme';
import { upcomingExams } from '@/lib/college';
import { attendanceBySubject, attendanceStats, topicProgress } from '@/lib/collegeStats';
import { addDays, fromDateKey, toDateKey } from '@/lib/dates';
import { compareScreenAndHabits, habitWeek, weekStart } from '@/lib/insights';
import { focusMinutesByProject } from '@/lib/projects';
import { formatDuration } from '@/lib/screentime';
import { recentDays } from '@/lib/stats';

const pct = (p: number | null) => (p === null ? '—' : `${Math.round(p)}%`);
const hours = (min: number) => `${Math.round((min / 60) * 10) / 10} h`;

function Stat({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  const theme = useTheme();
  return (
    <Card style={styles.stat}>
      <Text style={{ color: theme.muted, fontWeight: '600', fontSize: 12 }}>{label.toUpperCase()}</Text>
      <Text style={[styles.value, { color: warn ? theme.danger : theme.text }]}>{value}</Text>
      {sub ? <Text style={{ color: theme.muted, fontSize: 13 }}>{sub}</Text> : null}
    </Card>
  );
}

export default function InsightsScreen() {
  const theme = useTheme();
  const { state } = useHabits();
  const { college } = useCollege();
  const projects = useProjects();
  const screen = useScreenTime();
  const today = toDateKey(new Date());
  const monday = weekStart(today);

  const habits = habitWeek(state, today);
  const weekMins = focusMinutesByProject(projects.state, fromDateKey(monday).getTime(), fromDateKey(addDays(monday, 7)).getTime());
  const focusTotal = [...weekMins.values()].reduce((a, b) => a + b, 0);

  const weekMarks = college.attendance.filter((a) => a.subjectId && a.date >= monday && a.date <= today);
  const weekAtt = attendanceStats(weekMarks.filter((m) => m.status === 'present').length, weekMarks.length, college.attendanceTarget);
  // Includes the official portal figures where imported.
  const allAtt = attendanceBySubject(college).overall;

  const exams = upcomingExams(college, today).slice(0, 5);
  const studyThisWeek = college.study.filter((s) => s.date >= monday && s.date <= today);

  const habitDays = recentDays(state, today, 7);
  const screenAvg = screen.status === 'ready' && screen.week.length ? screen.week.reduce((a, d) => a + d.totalMs, 0) / screen.week.length : null;
  const comparison =
    screen.status === 'ready'
      ? compareScreenAndHabits(habitDays.map((d) => ({ day: d.day, done: d.done, scheduled: d.scheduled, screenMs: screen.week.find((w) => w.day === d.day)?.totalMs ?? 0 })))
      : null;

  return (
    <KeyboardScroll style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      <ScreenHeader title="Insights" />
      <Text style={{ color: theme.muted }}>This week (since Monday)</Text>
      <View style={styles.grid}>
        <Stat label="Habits" value={pct(habits.percent)} sub={`${habits.done}/${habits.scheduled} done`} />
        <Stat label="Focus" value={hours(focusTotal)} sub={`${weekMins.size} project${weekMins.size === 1 ? '' : 's'}`} />
        <Stat label="Attendance" value={pct(weekAtt.percent)} sub={`Overall ${pct(allAtt.percent)}`} warn={allAtt.percent !== null && allAtt.percent < college.attendanceTarget} />
        <Stat
          label="Screen time"
          value={screenAvg === null ? '—' : formatDuration(screenAvg)}
          sub={screen.status === 'ready' ? 'daily average, 7 days' : screen.status === 'no-access' ? 'allow Usage access' : 'Android app only'}
        />
      </View>

      {comparison ? (
        <Card>
          <Text style={{ color: theme.text, fontWeight: '700' }}>Phone use vs habits</Text>
          <Text style={{ color: theme.muted }}>
            On days under {formatDuration(comparison.thresholdMs)} of screen time you completed {pct(comparison.lowScreenHabitPct)} of habits; on heavier days,{' '}
            {pct(comparison.highScreenHabitPct)}.
          </Text>
        </Card>
      ) : null}

      {focusTotal > 0 ? (
        <>
          <SectionTitle>Focus by project</SectionTitle>
          {[...weekMins.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([id, m]) => (
              <View key={id || 'none'} style={styles.barRow}>
                <Text style={[styles.barLabel, { color: theme.text }]} numberOfLines={1}>
                  {projects.projects.find((p) => p.id === id)?.name ?? 'No project'}
                </Text>
                <View style={[styles.track, { backgroundColor: theme.border }]}>
                  <View style={[styles.fill, { width: `${(m / focusTotal) * 100}%`, backgroundColor: theme.primary }]} />
                </View>
                <Text style={{ color: theme.muted, width: 52, textAlign: 'right' }}>{hours(m)}</Text>
              </View>
            ))}
        </>
      ) : null}

      <SectionTitle>Exam prep</SectionTitle>
      {exams.length === 0 ? <Text style={{ color: theme.muted }}>No upcoming exams.</Text> : null}
      {exams.map(({ exam, title }) => {
        const t = topicProgress(exam);
        const sessions = college.study.filter((s) => s.examId === exam.id);
        return (
          <View key={exam.id} style={styles.barRow}>
            <Text style={[styles.barLabel, { color: theme.text }]} numberOfLines={1}>
              {college.subjects.find((x) => x.id === exam.subjectId)?.short ?? title}
            </Text>
            <View style={[styles.track, { backgroundColor: theme.border }]}>
              <View style={[styles.fill, { width: `${t.total ? (t.done / t.total) * 100 : 0}%`, backgroundColor: theme.accent }]} />
            </View>
            <Text style={{ color: theme.muted, width: 52, textAlign: 'right' }}>{t.total ? `${t.done}/${t.total}` : '—'}</Text>
            <Text style={{ color: theme.muted, width: 64, textAlign: 'right', fontSize: 12 }}>
              {sessions.length ? `${sessions.filter((s) => s.done).length}/${sessions.length} rev.` : ''}
            </Text>
          </View>
        );
      })}
      {studyThisWeek.length ? (
        <Text style={{ color: theme.muted }}>
          Revision this week: {studyThisWeek.filter((s) => s.done).length} of {studyThisWeek.length} planned sessions done.
        </Text>
      ) : null}
    </KeyboardScroll>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 10, paddingBottom: 40 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { flexBasis: '47%', flexGrow: 1, gap: 2 },
  value: { fontSize: 28, fontWeight: '800' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { width: 110, fontSize: 14, fontWeight: '600' },
  track: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
});
