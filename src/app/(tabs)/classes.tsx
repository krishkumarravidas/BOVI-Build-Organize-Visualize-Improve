import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip, ChipRow, EmptyText, KeyboardScroll, ListRow, SectionTitle, shortDate } from '@/components/ui';
import { useCollege } from '@/hooks/useCollege';
import { useTheme } from '@/hooks/useTheme';
import { nextClassDay, overlappingClassKeys, resolveDay } from '@/lib/college';
import { attendanceFor } from '@/lib/collegeStats';
import { addDays, toDateKey } from '@/lib/dates';
import { currentSemester, semesterProgress } from '@/lib/semesters';

const STATUS_BADGE = {
  changed: { text: 'Changed', tone: 'accent' },
  extra: { text: 'Extra', tone: 'accent' },
  cancelled: { text: 'Cancelled', tone: 'danger' },
} as const;

export default function ClassesScreen() {
  const theme = useTheme();
  const { college, ready } = useCollege();
  const today = toDateKey(new Date());
  const defaultDay = (ready && nextClassDay(college, today)) || today;
  const [picked, setPicked] = useState<string | null>(null);
  const day = picked ?? defaultDay;

  if (!ready) return <View style={{ flex: 1, backgroundColor: theme.background }} />;

  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const classes = resolveDay(college, day);
  const clashing = overlappingClassKeys(classes);
  const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
  const label = (d: string) => (d === today ? 'Today' : d === addDays(today, 1) ? 'Tomorrow' : shortDate(d));
  const sem = currentSemester(college);
  const semProgress = semesterProgress(sem, today);
  const semLine = semProgress?.status === 'during' ? `${sem.name} · week ${semProgress.week}${semProgress.weeks ? ` of ${semProgress.weeks}` : ''}` : sem.name;

  return (
    <KeyboardScroll
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingTop: 8 }]}
    >
      {college.profile ? <Text style={{ color: theme.muted }}>{college.profile}</Text> : null}
      {semProgress && semProgress.status !== 'during' ? (
        <ListRow
          title={semProgress.status === 'after' ? `${sem.name} has ended` : `${sem.name} starts ${shortDate(sem.start!)}`}
          subtitle={semProgress.status === 'after' ? 'No classes are shown after its end date. Start the next semester.' : 'Classes show from the start date.'}
          color={theme.warn}
          onPress={() => router.push('/college/semester')}
        />
      ) : null}

      <SectionTitle right={<Button title="Add class" variant="plain" onPress={() => router.push({ pathname: '/college/extra', params: { date: day } })} />}>
        {`Classes · ${label(day)}`}
      </SectionTitle>
      <ChipRow>
        {days.map((d) => (
          <Chip key={d} label={label(d)} selected={d === day} onPress={() => setPicked(d)} />
        ))}
      </ChipRow>
      {day !== today && !picked && day === defaultDay ? (
        <Text style={{ color: theme.muted }}>No classes today. Showing your next college day.</Text>
      ) : null}
      {classes.length === 0 ? (
        <EmptyText>No classes on this day.</EmptyText>
      ) : (
        classes.map((o) => (
          <ListRow
            key={o.key}
            title={o.title}
            subtitle={`${o.startText}–${o.endText} · ${o.room}${(() => {
              const a = attendanceFor(college, day, o.key);
              return a === 'present' ? ' · Present' : a === 'absent' ? ' · Absent' : '';
            })()}`}
            detail={o.note}
            color={o.subject?.color}
            muted={o.status === 'cancelled'}
            badge={
              o.status === 'cancelled'
                ? STATUS_BADGE.cancelled
                : clashing.has(o.key)
                  ? { text: 'Overlaps', tone: 'danger' }
                  : o.status === 'regular'
                    ? undefined
                    : STATUS_BADGE[o.status]
            }
            hint="Change, move or cancel this class"
            onPress={() => router.push({ pathname: '/college/class', params: { date: day, key: o.key } })}
          />
        ))
      )}

      <SectionTitle>Manage</SectionTitle>
      <ListRow title="Semester" subtitle={`${semLine}${(college.pastSemesters?.length ?? 0) ? ` · ${college.pastSemesters!.length} more saved` : ''}`} color={theme.primary} onPress={() => router.push('/college/semester')} />
      <ListRow title="Weekly timetable" subtitle={`${plural(college.slots.length, 'class', 'classes')} a week`} onPress={() => router.push('/college/timetable')} />
      <ListRow title="Subjects" subtitle={`${plural(college.subjects.length, 'subject')} · default room ${college.defaultRoom || 'not set'}`} onPress={() => router.push('/college/subjects')} />
      <ListRow title="Marks & grades" subtitle="IA marks and what you need in the final" onPress={() => router.push('/college/marks')} />
      <ListRow title="Events & clubs" subtitle={plural(college.events.length, 'event')} onPress={() => router.push('/college/events')} />
    </KeyboardScroll>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 10 },
  title: { fontSize: 34, fontWeight: '800' },
});
