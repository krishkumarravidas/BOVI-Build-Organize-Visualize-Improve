import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/Button';
import { EmptyText, KeyboardScroll, ListRow, ScreenHeader, shortDate } from '@/components/ui';
import { useCollege } from '@/hooks/useCollege';
import { useTheme } from '@/hooks/useTheme';

export default function EventsScreen() {
  const theme = useTheme();
  const { college } = useCollege();
  const events = [...college.events].sort((a, b) => a.startDate.localeCompare(b.startDate));

  return (
    <KeyboardScroll style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      <ScreenHeader title="Events & clubs" />
      <EmptyText>Workshops, fests and club events. Exams on the same days are flagged as clashes.</EmptyText>
      {events.length === 0 ? <EmptyText>No events yet.</EmptyText> : null}
      {events.map((e) => (
        <ListRow
          key={e.id}
          title={e.title}
          subtitle={e.startDate === e.endDate ? shortDate(e.startDate) : `${shortDate(e.startDate)} – ${shortDate(e.endDate)}`}
          detail={e.note}
          color={theme.accent}
          onPress={() => router.push({ pathname: '/college/event/[id]', params: { id: e.id } })}
        />
      ))}
      <Button title="Add event" onPress={() => router.push({ pathname: '/college/event/[id]', params: { id: 'new' } })} />
    </KeyboardScroll>
  );
}

const styles = StyleSheet.create({ content: { padding: 16, gap: 10, paddingBottom: 40 } });
