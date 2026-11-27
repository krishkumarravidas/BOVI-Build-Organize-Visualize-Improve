import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { formatEventTime } from '@/lib/agenda';
import type { TimelineItem } from '@/lib/timeline';
import type { DateKey } from '@/lib/types';

export const formatTime = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

interface Props {
  item: TimelineItem;
  day: DateKey;
  /** Blocks/classes/exams: open editor. Habits: toggle done. Events: no-op. */
  onPress?: () => void;
}

export function TimelineRow({ item, day, onPress }: Props) {
  const theme = useTheme();
  const time = item.kind === 'habit' ? formatTime(item.start) : formatEventTime({ ...item, allDay: false }, day, formatTime);
  const color =
    item.kind === 'block'
      ? theme.accent
      : item.kind === 'event'
        ? theme.primary
        : item.kind === 'class'
          ? item.color || theme.primary
          : item.kind === 'exam'
            ? theme.danger
            : item.kind === 'study'
              ? theme.accent
              : item.kind === 'course'
                ? item.color
                : theme.muted;
  const conflict = item.kind !== 'habit' && item.conflict;
  const subtitle = (() => {
    switch (item.kind) {
      case 'block':
        return 'Schedule';
      case 'event':
        return item.location || 'Calendar';
      case 'class':
        return `${item.room}${item.changed ? ' · changed' : ''}`;
      case 'exam':
        return `Exam${item.room ? ` · ${item.room}` : ''}`;
      case 'habit':
        return item.done ? 'Habit · done' : 'Habit';
      case 'study':
        return item.done ? 'Revision · done' : 'Revision';
      case 'task':
        return item.done ? 'Task · done' : 'Task';
      case 'course':
        return item.done ? 'Course · done' : 'Course';
    }
  })();

  const label =
    item.kind === 'habit'
      ? `${item.title}, ${time}, ${item.done ? 'done' : 'to do'}`
      : `${item.title}, ${time}, ${subtitle}${conflict ? ', overlaps another item' : ''}`;

  const hint =
    item.kind === 'habit' ? 'Toggles done' : item.kind === 'block' ? 'Edit block' : item.kind === 'class' ? 'Change this class' : item.kind === 'exam' ? 'Edit exam' : item.kind === 'study' || item.kind === 'task' || item.kind === 'course' ? 'Toggles done' : undefined;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: theme.surface, borderColor: conflict ? theme.danger : theme.border, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Text style={[styles.time, { color: theme.muted }]} numberOfLines={2}>
        {time}
      </Text>
      <View style={[styles.bar, { backgroundColor: color }]} />
      <View style={styles.body}>
        <Text
          style={[
            styles.title,
            { color: (item.kind === 'habit' || item.kind === 'study' || item.kind === 'task' || item.kind === 'course') && item.done ? theme.muted : theme.text },
            (item.kind === 'habit' || item.kind === 'study' || item.kind === 'task' || item.kind === 'course') && item.done && styles.done,
          ]}
          numberOfLines={2}
        >
          {item.title}
        </Text>
        <Text style={{ color: theme.muted }} numberOfLines={1}>
          {subtitle}
        </Text>
        {conflict ? <Text style={{ color: theme.danger, fontWeight: '600' }}>Overlaps</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  time: { width: 76, fontSize: 13, fontWeight: '600', paddingTop: 2 },
  bar: { width: 4, borderRadius: 2 },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: '600' },
  done: { textDecorationLine: 'line-through' },
});
