import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { EmptyText, SectionTitle, shortDate } from '@/components/ui';
import { useCollege } from '@/hooks/useCollege';
import { useTheme } from '@/hooks/useTheme';
import { toDateKey } from '@/lib/dates';
import type { Assignment } from '@/lib/college';

export default function AssignmentsScreen() {
  const theme = useTheme();
  const c = useCollege();
  const today = toDateKey(new Date());
  const open = c.college.assignments.filter((a) => !a.done).sort((a, b) => a.due.localeCompare(b.due));
  const done = c.college.assignments.filter((a) => a.done).sort((a, b) => b.due.localeCompare(a.due));

  const row = (a: Assignment) => {
    const subject = c.college.subjects.find((s) => s.id === a.subjectId);
    const overdue = !a.done && a.due < today;
    return (
      <View key={a.id} style={[styles.row, { backgroundColor: theme.surface, borderColor: overdue ? theme.danger : theme.border }]}>
        <Pressable
          onPress={() => c.toggleAssignment(a.id)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: a.done }}
          accessibilityLabel={a.title}
          style={[styles.check, { borderColor: theme.primary, backgroundColor: a.done ? theme.primary : 'transparent' }]}
        >
          {a.done ? <Ionicons name="checkmark" size={16} color={theme.onPrimary} /> : null}
        </Pressable>
        <Pressable style={{ flex: 1 }} onPress={() => router.push({ pathname: '/college/assignment/[id]', params: { id: a.id } })} accessibilityRole="button" accessibilityHint="Edit assignment">
          <Text style={[styles.title, { color: a.done ? theme.muted : theme.text }, a.done && styles.strike]}>{a.title}</Text>
          <Text style={{ color: overdue ? theme.danger : theme.muted }}>
            {overdue ? 'Overdue · ' : ''}Due {shortDate(a.due)}
            {subject ? ` · ${subject.short}` : ''}
          </Text>
        </Pressable>
      </View>
    );
  };

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      {open.length === 0 ? <EmptyText>No open assignments.</EmptyText> : open.map(row)}
      <Button title="Add assignment" onPress={() => router.push({ pathname: '/college/assignment/[id]', params: { id: 'new' } })} />
      {done.length ? <SectionTitle>Done</SectionTitle> : null}
      {done.map(row)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 10, paddingBottom: 40 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  check: { width: 26, height: 26, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '600' },
  strike: { textDecorationLine: 'line-through' },
});
