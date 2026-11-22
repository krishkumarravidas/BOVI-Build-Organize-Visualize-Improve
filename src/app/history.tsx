import { StyleSheet, Text, View } from 'react-native';

import { KeyboardScroll, ScreenHeader } from '@/components/ui';
import { useHabits } from '@/hooks/useHabits';
import { useTheme } from '@/hooks/useTheme';
import { fromDateKey, toDateKey } from '@/lib/dates';
import { currentStreak, longestStreak } from '@/lib/streaks';
import { recentDays } from '@/lib/stats';

const BAR_HEIGHT = 96;

export default function HistoryScreen() {
  const theme = useTheme();
  const { state } = useHabits();
  const today = toDateKey(new Date());
  const days = recentDays(state, today, 7);
  const habits = state.habits.filter((h) => !h.archivedAt);

  return (
    <KeyboardScroll
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingTop: 16 }]}
    >
      <ScreenHeader title="History" />

      <Text style={[styles.section, { color: theme.muted }]}>Last 7 days</Text>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.bars}>
          {days.map((d) => {
            const ratio = d.scheduled === 0 ? 0 : d.done / d.scheduled;
            const label = fromDateKey(d.day).toLocaleDateString(undefined, { weekday: 'narrow' });
            return (
              <View
                key={d.day}
                style={styles.barCol}
                accessible
                accessibilityLabel={`${d.day}: ${d.done} of ${d.scheduled} done`}
              >
                <View style={[styles.barTrack, { backgroundColor: theme.border }]}>
                  <View
                    style={[styles.barFill, { backgroundColor: theme.primary, height: BAR_HEIGHT * ratio }]}
                  />
                </View>
                <Text style={{ color: d.day === today ? theme.text : theme.muted, fontWeight: '600' }}>{label}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <Text style={[styles.section, { color: theme.muted }]}>Streaks</Text>
      {habits.length === 0 ? (
        <Text style={{ color: theme.muted }}>Your habits and streaks will show up here.</Text>
      ) : (
        habits.map((h) => {
          const done = state.completions[h.id] ?? [];
          return (
            <View
              key={h.id}
              style={[styles.streakRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <Text style={[styles.habitName, { color: theme.text }]} numberOfLines={1}>
                {h.name}
              </Text>
              <Text style={{ color: theme.muted }}>
                Current {currentStreak(h, done, today)} · Best {longestStreak(h, done)}
              </Text>
            </View>
          );
        })
      )}
    </KeyboardScroll>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 10 },
  title: { fontSize: 34, fontWeight: '800', marginBottom: 6 },
  section: { fontSize: 14, fontWeight: '600', textTransform: 'uppercase', marginTop: 10 },
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  bars: { flexDirection: 'row', justifyContent: 'space-between' },
  barCol: { alignItems: 'center', gap: 8, flex: 1 },
  barTrack: { width: 20, height: BAR_HEIGHT, borderRadius: 10, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', borderRadius: 10 },
  streakRow: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 2 },
  habitName: { fontSize: 17, fontWeight: '600' },
});
