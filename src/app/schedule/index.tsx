import { router, Stack } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { useHabits } from '@/hooks/useHabits';
import { useTheme } from '@/hooks/useTheme';
import { describeDays, isOvernight } from '@/lib/schedule';

export default function ScheduleScreen() {
  const theme = useTheme();
  const { state } = useHabits();
  const blocks = [...state.blocks].sort((a, b) => a.start.localeCompare(b.start));

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Schedule',
          headerStyle: { backgroundColor: theme.background },
          headerTitleStyle: { color: theme.text },
          headerTintColor: theme.primary,
        }}
      />
      <FlatList
        data={blocks}
        keyExtractor={(b) => b.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No schedule blocks yet</Text>
            <Text style={{ color: theme.muted, textAlign: 'center' }}>
              Add recurring blocks like classes, work or gym. They show up on Today and in your Agenda.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/schedule/[id]', params: { id: item.id } })}
            accessibilityRole="button"
            accessibilityHint="Edit block"
            style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <View style={[styles.bar, { backgroundColor: theme.accent }]} />
            <View style={styles.body}>
              <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={{ color: theme.muted }}>
                {item.start} – {item.end}
                {isOvernight(item) ? ' (next day)' : ''} · {describeDays(item.days)}
              </Text>
            </View>
          </Pressable>
        )}
      />
      <View style={styles.footer}>
        <Button title="Add block" onPress={() => router.push({ pathname: '/schedule/[id]', params: { id: 'new' } })} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, flexGrow: 1 },
  empty: { alignItems: 'center', gap: 6, paddingVertical: 48, paddingHorizontal: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  bar: { width: 4, borderRadius: 2 },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 17, fontWeight: '600' },
  footer: { padding: 16 },
});
