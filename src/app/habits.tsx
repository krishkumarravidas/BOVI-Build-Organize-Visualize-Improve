import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { Button } from '@/components/Button';
import { HabitRow } from '@/components/HabitRow';
import { EmptyText, KeyboardScroll, ListRow, ScreenHeader, SectionTitle } from '@/components/ui';
import { useHabits } from '@/hooks/useHabits';
import { useTheme } from '@/hooks/useTheme';
import { toDateKey } from '@/lib/dates';
import { habitsForDay, isCompleted } from '@/lib/habits';
import { describeDays } from '@/lib/schedule';
import { currentStreak } from '@/lib/streaks';

export default function HabitsScreen() {
  const theme = useTheme();
  const { state, toggle } = useHabits();
  const today = toDateKey(new Date());
  const todays = habitsForDay(state, today);
  const others = state.habits.filter((h) => !h.archivedAt && !todays.includes(h));
  const doneCount = todays.filter((h) => isCompleted(state, h.id, today)).length;

  return (
    <KeyboardScroll style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      <ScreenHeader title="Habits" />
      <SectionTitle>{todays.length ? `Today · ${doneCount} of ${todays.length} done` : 'Today'}</SectionTitle>
      {todays.length === 0 ? <EmptyText>No habits scheduled today.</EmptyText> : null}
      {todays.map((h) => (
        <HabitRow
          key={h.id}
          name={h.name}
          done={isCompleted(state, h.id, today)}
          streak={currentStreak(h, state.completions[h.id] ?? [], today)}
          onToggle={() => toggle(h.id, today, !isCompleted(state, h.id, today))}
          onPress={() => router.push({ pathname: '/habit/[id]', params: { id: h.id } })}
        />
      ))}
      {others.length ? <SectionTitle>Other days</SectionTitle> : null}
      {others.map((h) => (
        <ListRow key={h.id} title={h.name} subtitle={`${describeDays(h.days)}${h.reminderTime ? ` · ${h.reminderTime}` : ''}`} onPress={() => router.push({ pathname: '/habit/[id]', params: { id: h.id } })} />
      ))}
      <Button title="Add habit" onPress={() => router.push({ pathname: '/habit/[id]', params: { id: 'new' } })} />
      <ListRow title="Habit history" subtitle="Streaks and the last 7 days" color={theme.accent} onPress={() => router.push('/history')} />
      <Text style={{ color: theme.muted }}>Habits also appear on the calendar: timed ones on the timeline, the rest in the to-do list.</Text>
    </KeyboardScroll>
  );
}

const styles = StyleSheet.create({ content: { padding: 16, gap: 10, paddingBottom: 40 } });
