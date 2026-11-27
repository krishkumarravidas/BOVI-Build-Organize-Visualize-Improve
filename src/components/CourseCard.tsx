import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { coursePace, courseProgress, nextLesson, slotsOn, weeklyMinutes, type Course } from '@/lib/courses';
import { addDays, toDateKey } from '@/lib/dates';
import { formatTime, uses12HourClock } from '@/lib/timeFormat';
import { radius } from '@/theme/colors';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** The next study slot from now (today or within a week), e.g. "Today 7:00 pm", "Thu 7:00 pm". */
export function nextSession(course: Course, now: Date): string | null {
  const today = toDateKey(now);
  const h12 = uses12HourClock();
  const nowHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  for (let i = 0; i < 7; i++) {
    const d = addDays(today, i);
    const slot = slotsOn(course, d).find((s) => i > 0 || s.end > nowHHMM);
    if (slot) return `${i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : DAYS[new Date(`${d}T12:00`).getDay()]} ${formatTime(slot.start, h12)}`;
  }
  return null;
}

export function CourseCard({ course, now }: { course: Course; now: Date }) {
  const theme = useTheme();
  const prog = courseProgress(course);
  const pace = coursePace(course, now);
  const next = nextLesson(course);
  const session = nextSession(course, now);
  const weekly = weeklyMinutes(course);
  const paceLine =
    course.status === 'done' || pace.remaining === 0
      ? 'Finished'
      : pace.neededPerWeek !== null
        ? `${pace.neededPerWeek}/week to finish on time${pace.onTrack === false ? ' · behind' : pace.onTrack ? ' · on track' : ''}`
        : pace.recentPerWeek
          ? `${pace.recentPerWeek} lessons/week lately`
          : null;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/course/[id]', params: { id: course.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${course.title}, ${Math.round(prog.percent)} percent done`}
      style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <View style={styles.top}>
        <View style={[styles.dot, { backgroundColor: course.color }]} />
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
          {course.title}
        </Text>
        <Text style={[styles.pct, { color: theme.text }]}>{prog.total ? `${Math.round(prog.percent)}%` : '—'}</Text>
      </View>
      <View style={[styles.track, { backgroundColor: theme.raised }]}>
        <View style={{ width: `${prog.percent}%`, height: '100%', borderRadius: 3, backgroundColor: course.color }} />
      </View>
      <Text style={{ color: theme.muted, fontSize: 13 }} numberOfLines={1}>
        {prog.total ? `${prog.done}/${prog.total} lessons` : 'No lessons yet: paste the curriculum'}
        {course.provider ? ` · ${course.provider}` : ''}
        {course.status === 'paused' ? ' · paused' : ''}
      </Text>
      {next && course.status !== 'done' ? (
        <Text style={{ color: theme.text }} numberOfLines={1}>
          Next: {next.lesson.title}
        </Text>
      ) : null}
      <Text style={{ color: pace.onTrack === false ? theme.danger : theme.muted, fontSize: 13 }} numberOfLines={1}>
        {[session ? `Study ${session}` : weekly ? null : 'No study time set', paceLine].filter(Boolean).join(' · ')}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 6 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  title: { flex: 1, fontSize: 16, fontWeight: '700' },
  pct: { fontSize: 16, fontWeight: '800' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
});
