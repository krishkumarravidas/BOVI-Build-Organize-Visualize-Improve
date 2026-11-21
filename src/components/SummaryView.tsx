import { StyleSheet, Text, View } from 'react-native';

import { Stat, StatRow } from '@/components/gamedev/common';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { hours, type PeriodSummary } from '@/lib/summary';

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');

/** The numbers behind the weekly review and the monthly report. */
export function SummaryView({ s }: { s: PeriodSummary }) {
  const theme = useTheme();
  const { settings } = useSettings();
  const card = [styles.card, { backgroundColor: theme.surface, borderColor: theme.border }];
  return (
    <>
      <View style={card}>
        <Text style={[styles.head, { color: theme.text }]}>{settings.projectsTabName}</Text>
        <StatRow>
          <Stat value={hours(s.gamedevMin)} label="focus" />
          <Stat value={String(s.gamedevDays)} label="active days" />
          <Stat value={s.streak ? `${s.streak} d` : '0'} label="streak" />
        </StatRow>
        <StatRow>
          <Stat value={String(s.tasksDone)} label="tasks/features" />
          <Stat value={String(s.milestonesDone)} label="milestones" />
          <Stat value={String(s.bugsFixed)} label="bugs fixed" />
        </StatRow>
        {s.topProject ? <Text style={{ color: theme.muted }}>Most time on {s.topProject.name} ({hours(s.topProject.minutes)}).</Text> : null}
        {s.builds.length ? <Text style={{ color: theme.accent, fontWeight: '600' }}>Shipped {s.builds.join(', ')}</Text> : null}
        {s.playtests || s.devlogEntries || s.ideas ? (
          <Text style={{ color: theme.muted }}>
            {[s.playtests ? `${s.playtests} playtest${s.playtests === 1 ? '' : 's'}` : '', s.devlogEntries ? `${s.devlogEntries} devlog entr${s.devlogEntries === 1 ? 'y' : 'ies'}` : '', s.ideas ? `${s.ideas} new idea${s.ideas === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ')}
          </Text>
        ) : null}
      </View>
      <View style={card}>
        <Text style={[styles.head, { color: theme.text }]}>College</Text>
        <StatRow>
          <Stat value={hours(s.studyMin)} label="study" />
          <Stat value={pct(s.attendance.present, s.attendance.total)} label={`attendance${s.attendance.total ? ` (${s.attendance.present}/${s.attendance.total})` : ''}`} />
        </StatRow>
        {s.examsTaken.length ? <Text style={{ color: theme.muted }}>Exams: {s.examsTaken.join(', ')}</Text> : null}
      </View>
      <View style={card}>
        <Text style={[styles.head, { color: theme.text }]}>Habits</Text>
        <StatRow>
          <Stat value={pct(s.habits.done, s.habits.total)} label={`done (${s.habits.done}/${s.habits.total})`} />
        </StatRow>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 10 },
  head: { fontSize: 16, fontWeight: '800' },
});
