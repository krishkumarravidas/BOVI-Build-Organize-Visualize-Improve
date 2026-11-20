import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { Button } from '@/components/Button';
import { Chip, ChipRow, EmptyText, ListRow, ScreenHeader } from '@/components/ui';
import { useCollege } from '@/hooks/useCollege';
import { useTheme } from '@/hooks/useTheme';
import { subjectName } from '@/lib/college';
import type { Weekday } from '@/lib/types';

const DAYS: { day: Weekday; label: string }[] = [
  { day: 1, label: 'Mon' },
  { day: 2, label: 'Tue' },
  { day: 3, label: 'Wed' },
  { day: 4, label: 'Thu' },
  { day: 5, label: 'Fri' },
  { day: 6, label: 'Sat' },
  { day: 0, label: 'Sun' },
];

export default function TimetableScreen() {
  const theme = useTheme();
  const { college } = useCollege();
  const todayDay = new Date().getDay() as Weekday;
  const [day, setDay] = useState<Weekday>(todayDay === 0 || todayDay === 6 ? 1 : todayDay);
  const slots = college.slots.filter((s) => s.day === day).sort((a, b) => a.start.localeCompare(b.start));

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      <ScreenHeader title="Weekly timetable" />
      <ChipRow>
        {DAYS.map((d) => (
          <Chip key={d.day} label={d.label} selected={d.day === day} onPress={() => setDay(d.day)} />
        ))}
      </ChipRow>
      {slots.length === 0 ? (
        <EmptyText>No classes on this day.</EmptyText>
      ) : (
        slots.map((s) => (
          <ListRow
            key={s.id}
            title={subjectName(college, s.subjectId, s.title)}
            subtitle={`${s.start}–${s.end} · ${s.room || college.defaultRoom}`}
            detail={s.note}
            color={college.subjects.find((x) => x.id === s.subjectId)?.color}
            hint="Edit class"
            onPress={() => router.push({ pathname: '/college/slot/[id]', params: { id: s.id } })}
          />
        ))
      )}
      <Button title="Add class to this day" onPress={() => router.push({ pathname: '/college/slot/[id]', params: { id: 'new', day: String(day) } })} />
      <EmptyText>Changes here apply every week. To change a single day, tap the class on the College tab.</EmptyText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: 16, gap: 10, paddingBottom: 40 } });
