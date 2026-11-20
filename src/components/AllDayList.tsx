import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import type { AgendaEvent } from '@/lib/agenda';

export function AllDayList({ events }: { events: readonly AgendaEvent[] }) {
  const theme = useTheme();
  if (events.length === 0) return null;
  return (
    <View style={styles.wrap}>
      {events.map((e) => (
        <View
          key={`${e.id}:${e.start.getTime()}`}
          style={[styles.chip, { borderColor: theme.primary }]}
          accessible
          accessibilityLabel={`${e.title}, all day`}
        >
          <Text style={{ color: theme.text, fontWeight: '600' }} numberOfLines={1}>
            {e.title}
          </Text>
          <Text style={{ color: theme.muted, fontSize: 12 }}>All day</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, maxWidth: '100%' },
});
