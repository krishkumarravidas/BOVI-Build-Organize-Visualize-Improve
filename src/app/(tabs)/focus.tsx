import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { FocusTimer } from '@/components/FocusTimer';
import { EmptyText, SectionTitle, shortDate } from '@/components/ui';
import { useProjects } from '@/hooks/useProjects';
import { useTheme } from '@/hooks/useTheme';
import { addDays, fromDateKey, toDateKey } from '@/lib/dates';
import { weekStart } from '@/lib/insights';
import { focusMinutesByProject } from '@/lib/projects';

const hours = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? ` ${min % 60}m` : ''}` : `${min}m`);

export default function FocusTab() {
  const theme = useTheme();
  const p = useProjects();
  const today = toDateKey(new Date());
  const monday = weekStart(today);
  const week = focusMinutesByProject(p.state, fromDateKey(monday).getTime(), fromDateKey(addDays(monday, 7)).getTime());
  const total = [...week.values()].reduce((a, b) => a + b, 0);
  const recent = p.state.focus.filter((f) => !f.subjectId).sort((a, b) => b.start - a.start).slice(0, 12);
  const name = (id?: string) => p.projects.find((x) => x.id === id)?.name ?? 'No project';

  // Minutes per day this week (Mon..Sun) for a mini chart.
  const perDay = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(monday, i);
    const m = focusMinutesByProject(p.state, fromDateKey(d).getTime(), fromDateKey(addDays(d, 1)).getTime());
    return { d, min: [...m.values()].reduce((a, b) => a + b, 0) };
  });
  const maxDay = Math.max(30, ...perDay.map((x) => x.min));

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      <FocusTimer />

      <SectionTitle>{`This week · ${hours(total)}`}</SectionTitle>
      <View style={[styles.chart, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {perDay.map(({ d, min }) => (
          <View key={d} style={styles.col} accessible accessibilityLabel={`${shortDate(d)}: ${hours(min)}`}>
            <Text style={{ color: theme.muted, fontSize: 10, height: 14 }}>{min ? hours(min) : ''}</Text>
            <View style={[styles.track, { backgroundColor: theme.border }]}>
              <View style={[styles.fill, { height: `${(min / maxDay) * 100}%`, backgroundColor: theme.primary }]} />
            </View>
            <Text style={{ color: d === today ? theme.text : theme.muted, fontWeight: '600' }}>{fromDateKey(d).toLocaleDateString(undefined, { weekday: 'narrow' })}</Text>
          </View>
        ))}
      </View>
      {[...week.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([id, m]) => (
          <View key={id || 'none'} style={styles.row}>
            <Text style={[styles.rowLabel, { color: theme.text }]} numberOfLines={1}>
              {name(id || undefined)}
            </Text>
            <View style={[styles.hTrack, { backgroundColor: theme.border }]}>
              <View style={[styles.hFill, { width: `${(m / total) * 100}%`, backgroundColor: theme.accent }]} />
            </View>
            <Text style={{ color: theme.muted, width: 56, textAlign: 'right' }}>{hours(m)}</Text>
          </View>
        ))}

      <SectionTitle>Recent sessions</SectionTitle>
      {recent.length === 0 ? <EmptyText>No focus sessions yet. Start one above.</EmptyText> : null}
      {recent.map((s) => (
        <Text key={s.id} style={{ color: theme.text }}>
          {shortDate(toDateKey(new Date(s.start)))} · {new Date(s.start).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} · {s.minutes} min ·{' '}
          <Text style={{ color: theme.muted }}>{name(s.projectId)}</Text>
        </Text>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingTop: 8, gap: 10, paddingBottom: 32 },
  chart: { flexDirection: 'row', borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 12 },
  col: { flex: 1, alignItems: 'center', gap: 4 },
  track: { width: 16, height: 80, borderRadius: 8, justifyContent: 'flex-end', overflow: 'hidden' },
  fill: { width: '100%', borderRadius: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowLabel: { width: 130, fontWeight: '600' },
  hTrack: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  hFill: { height: '100%', borderRadius: 4 },
});
