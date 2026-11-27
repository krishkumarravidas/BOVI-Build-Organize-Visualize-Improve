import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { CheckRow } from '@/components/gamedev/common';
import { Card, Chip, ChipRow, DateField, EmptyText, ErrorText, Field, FormScreen, ScreenHeader, SectionTitle, TimeRangeFields, confirmDestructive, shortDate } from '@/components/ui';
import { useCourses } from '@/hooks/useCourses';
import { newId } from '@/hooks/useCollege';
import { useTheme } from '@/hooks/useTheme';
import {
  COURSE_COLORS,
  addSections,
  consistency,
  coursePace,
  courseProgress,
  markSession,
  nextLesson,
  parseCurriculum,
  removeLesson,
  toggleLesson,
  unmarkedSessions,
  validateCourse,
  validateSlot,
  weeklyMinutes,
  type Course,
  type CourseStatus,
} from '@/lib/courses';
import { normalizeUrl } from '@/lib/links';
import { formatDuration } from '@/lib/screentime';
import { formatTime, uses12HourClock } from '@/lib/timeFormat';
import type { Weekday } from '@/lib/types';
import { mix } from '@/theme/contrast';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const STATUS: { value: CourseStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'done', label: 'Finished' },
];
const PASTE_HINT = 'One lesson per line. Lines like "Section 2: Blueprints" or ending in ":" start a section. Durations such as 12:34 or 15 min are picked up.';

export default function CourseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const c = useCourses();
  const course = c.get(id);
  if (!c.ready) return <View style={{ flex: 1, backgroundColor: theme.background }} />;
  if (!course) {
    return (
      <FormScreen>
        <ScreenHeader title="Course" />
        <EmptyText>This course no longer exists.</EmptyText>
      </FormScreen>
    );
  }
  return <CourseBody course={course} />;
}

function CourseBody({ course }: { course: Course }) {
  const theme = useTheme();
  const c = useCourses();
  const update = (fn: (x: Course) => Course) => c.update(course.id, fn);
  const [now] = useState(() => new Date());
  const h12 = uses12HourClock();
  const prog = courseProgress(course);
  const pace = coursePace(course, now);
  const cons = consistency(course);
  const next = nextLesson(course);
  const toMark = unmarkedSessions(course, now, 14);

  const [paste, setPaste] = useState('');
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set(next ? [next.section.id] : []));
  // Schedule form
  const [days, setDays] = useState<Weekday[]>([]);
  const [start, setStart] = useState('19:00');
  const [end, setEnd] = useState('20:00');
  const [slotError, setSlotError] = useState<string | null>(null);
  // Details form
  const [title, setTitle] = useState(course.title);
  const [provider, setProvider] = useState(course.provider ?? '');
  const [url, setUrl] = useState(course.url ?? '');
  const [target, setTarget] = useState(course.target ?? '');
  const [notes, setNotes] = useState(course.notes ?? '');
  const [detailError, setDetailError] = useState<string | null>(null);
  const [saved, setSaved] = useState(true);

  const addPasted = () => {
    const sections = parseCurriculum(paste, newId);
    if (!sections.length) return;
    update((x) => addSections(x, sections));
    setOpenSections((s) => new Set([...s, sections[0].id]));
    setPaste('');
  };

  const addSlots = () => {
    const err = days.length ? validateSlot({ start, end }) : 'Pick at least one day';
    setSlotError(err);
    if (err) return;
    update((x) => ({ ...x, slots: [...x.slots, ...days.map((day) => ({ id: newId(), day, start, end }))] }));
    setDays([]);
  };

  const saveDetails = () => {
    const cleanUrl = url.trim() ? normalizeUrl(url) : null;
    if (url.trim() && !cleanUrl) return setDetailError('That link doesn’t look right. Paste the full address.');
    const err = validateCourse({ title, target: target || undefined, startedAt: course.startedAt });
    setDetailError(err);
    if (err) return;
    update((x) => ({ ...x, title: title.trim(), provider: provider.trim() || undefined, url: cleanUrl ?? undefined, target: target || undefined, notes: notes.trim() || undefined }));
    setSaved(true);
  };
  const dirty = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setSaved(false);
  };

  const paceText = (() => {
    if (prog.total === 0) return 'Add lessons to see your pace.';
    if (pace.remaining === 0) return 'All lessons done.';
    const parts: string[] = [];
    if (course.target && pace.neededPerWeek !== null)
      parts.push(pace.daysToTarget! < 0 ? `Planned to finish ${shortDate(course.target)}: that date has passed` : `${pace.neededPerWeek} ${pace.neededPerWeek === 1 ? 'lesson' : 'lessons'} a week to finish by ${shortDate(course.target)}`);
    parts.push(pace.recentPerWeek ? `you’re doing ${pace.recentPerWeek} a week` : 'no lessons done in the last 2 weeks');
    if (pace.projectedFinish) parts.push(`at that pace you finish ${shortDate(pace.projectedFinish)}`);
    return parts.join(' · ');
  })();

  return (
    <FormScreen>
      <ScreenHeader title={course.title} />

      {/* Progress */}
      <Card style={{ gap: 8 }}>
        <View style={styles.row}>
          <Text style={[styles.big, { color: theme.text }]}>{prog.total ? `${Math.round(prog.percent)}%` : '—'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontWeight: '600' }}>
              {prog.done} of {prog.total} lessons
            </Text>
            {prog.minutesTotal ? (
              <Text style={{ color: theme.muted, fontSize: 13 }}>
                {formatDuration(prog.minutesDone * 60_000)} of {formatDuration(prog.minutesTotal * 60_000)} watched
              </Text>
            ) : null}
          </View>
        </View>
        <View style={[styles.track, { backgroundColor: theme.raised }]}>
          <View style={{ width: `${prog.percent}%`, height: '100%', borderRadius: 4, backgroundColor: course.color }} />
        </View>
        <Text style={{ color: pace.onTrack === false ? theme.danger : theme.muted }}>{paceText}</Text>
        <Text style={{ color: theme.muted, fontSize: 13 }}>
          Study sessions kept: {cons.percent === null ? 'none marked yet' : `${Math.round(cons.percent)}% (${cons.done} done, ${cons.skipped} skipped) · streak ${cons.streak}`}
        </Text>
      </Card>

      {/* Next lesson */}
      {next && course.status !== 'done' ? (
        <Card style={{ gap: 8, backgroundColor: mix(theme.surface, course.color, 0.08) }}>
          <Text style={[styles.overline, { color: theme.muted }]}>UP NEXT · {next.section.title.toUpperCase()}</Text>
          <Text style={[styles.nextTitle, { color: theme.text }]}>{next.lesson.title}</Text>
          {next.lesson.minutes ? <Text style={{ color: theme.muted }}>{formatDuration(next.lesson.minutes * 60_000)}</Text> : null}
          <Button title="Mark done" onPress={() => update((x) => toggleLesson(x, next.lesson.id, Date.now()))} />
          {course.url ? <Button title="Open course" variant="plain" onPress={() => Linking.openURL(course.url!)} /> : null}
        </Card>
      ) : null}

      {/* Sessions to mark */}
      {toMark.length ? (
        <>
          <SectionTitle>{`Did you study? · ${toMark.length}`}</SectionTitle>
          {toMark.map(({ date, slot }) => (
            <View key={`${date}:${slot.id}`} style={[styles.markRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={{ color: theme.text, flex: 1 }}>
                {shortDate(date)} · {formatTime(slot.start, h12)}
              </Text>
              {(['done', 'skipped'] as const).map((st) => (
                <Pressable
                  key={st}
                  onPress={() => update((x) => markSession(x, date, slot.id, st))}
                  accessibilityRole="button"
                  accessibilityLabel={`${shortDate(date)} ${slot.start}: ${st === 'done' ? 'Done' : 'Skipped'}`}
                  style={[styles.markBtn, { borderColor: st === 'done' ? theme.accent : theme.danger }]}
                >
                  <Text style={{ color: st === 'done' ? theme.accent : theme.danger, fontWeight: '700' }}>{st === 'done' ? 'Done' : 'Skipped'}</Text>
                </Pressable>
              ))}
            </View>
          ))}
        </>
      ) : null}

      {/* Lessons */}
      <SectionTitle>Lessons</SectionTitle>
      {course.sections.length === 0 ? <EmptyText>No lessons yet. Paste the course’s curriculum below.</EmptyText> : null}
      {course.sections.map((s) => {
        const open = openSections.has(s.id);
        const done = s.lessons.filter((l) => l.done).length;
        return (
          <Card key={s.id} style={{ gap: 10 }}>
            <Pressable
              onPress={() => setOpenSections((set) => (open ? new Set([...set].filter((x) => x !== s.id)) : new Set([...set, s.id])))}
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              style={styles.row}
            >
              <Text style={[styles.sectionTitle, { color: theme.text }]} numberOfLines={2}>
                {s.title}
              </Text>
              <Text style={{ color: done === s.lessons.length ? theme.accent : theme.muted, fontWeight: '600' }}>
                {done}/{s.lessons.length}
              </Text>
            </Pressable>
            {open
              ? s.lessons.map((l) => (
                  <CheckRow
                    key={l.id}
                    done={l.done}
                    title={l.title}
                    detail={l.minutes ? formatDuration(l.minutes * 60_000) : undefined}
                    color={course.color}
                    onToggle={() => update((x) => toggleLesson(x, l.id, Date.now()))}
                    right={
                      <Pressable
                        onPress={() => confirmDestructive('Remove lesson?', l.title, 'Remove', () => update((x) => removeLesson(x, l.id)))}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${l.title}`}
                      >
                        <Text style={{ color: theme.muted, fontSize: 18 }}>×</Text>
                      </Pressable>
                    }
                  />
                ))
              : null}
          </Card>
        );
      })}
      <Field label="Add lessons" value={paste} onChangeText={setPaste} multiline placeholder={'Section 1: Getting started\nWelcome 3:12\nInstalling the engine 12:45'} hint={PASTE_HINT} />
      <Button title="Add lessons" variant="plain" onPress={addPasted} disabled={!paste.trim()} />

      {/* Schedule */}
      <SectionTitle>Study times</SectionTitle>
      <Text style={{ color: theme.muted }}>
        {course.slots.length ? `${formatDuration(weeklyMinutes(course) * 60_000)} a week. These show on your calendar; tap one there to mark it done.` : 'Set when you’ll study each week, like a class. They show on your calendar.'}
      </Text>
      {course.slots
        .slice()
        .sort((a, b) => a.day - b.day || a.start.localeCompare(b.start))
        .map((s) => (
          <View key={s.id} style={[styles.markRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={{ color: theme.text, flex: 1 }}>
              {DAYS[s.day]} · {formatTime(s.start, h12)} – {formatTime(s.end, h12)}
            </Text>
            <Pressable onPress={() => update((x) => ({ ...x, slots: x.slots.filter((y) => y.id !== s.id) }))} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Remove ${DAYS[s.day]} ${s.start}`}>
              <Text style={{ color: theme.muted, fontSize: 18 }}>×</Text>
            </Pressable>
          </View>
        ))}
      <ChipRow>
        {DAYS.map((d, i) => (
          <Chip key={d} label={d} selected={days.includes(i as Weekday)} onPress={() => setDays((x) => (x.includes(i as Weekday) ? x.filter((y) => y !== i) : [...x, i as Weekday]))} />
        ))}
      </ChipRow>
      <TimeRangeFields start={start} end={end} onStart={setStart} onEnd={setEnd} />
      <ErrorText>{slotError}</ErrorText>
      <Button title="Add study time" variant="plain" onPress={addSlots} />

      {/* Details */}
      <SectionTitle>Details</SectionTitle>
      <ChipRow>
        {STATUS.map((st) => (
          <Chip key={st.value} label={st.label} selected={course.status === st.value} onPress={() => update((x) => ({ ...x, status: st.value }))} />
        ))}
      </ChipRow>
      <Field label="Name" value={title} onChangeText={dirty(setTitle)} />
      <Field label="Where (optional)" value={provider} onChangeText={dirty(setProvider)} placeholder="e.g. Udemy, YouTube, a book" />
      <Field label="Link (optional)" value={url} onChangeText={dirty(setUrl)} placeholder="https://…" autoCapitalize="none" keyboardType="url" />
      <DateField label="Finish by (optional)" value={target} onChange={dirty(setTarget)} optional />
      <Field label="Notes (optional)" value={notes} onChangeText={dirty(setNotes)} multiline />
      <ErrorText>{detailError}</ErrorText>
      <Button title={saved ? 'Saved' : 'Save details'} variant={saved ? 'plain' : 'primary'} onPress={saveDetails} disabled={saved} />

      <Text style={[styles.label, { color: theme.muted }]}>Colour</Text>
      <ChipRow>
        {COURSE_COLORS.map((col) => (
          <Pressable
            key={col}
            onPress={() => update((x) => ({ ...x, color: col }))}
            accessibilityRole="radio"
            accessibilityState={{ selected: course.color === col }}
            accessibilityLabel={`Colour ${col}`}
            style={[styles.swatch, { backgroundColor: col, borderColor: course.color === col ? theme.text : 'transparent' }]}
          />
        ))}
      </ChipRow>
      {c.projects.length ? (
        <>
          <Text style={[styles.label, { color: theme.muted }]}>For a project (optional)</Text>
          <ChipRow>
            <Chip label="None" selected={!course.projectId} onPress={() => update((x) => ({ ...x, projectId: undefined }))} />
            {c.projects.map((p) => (
              <Chip key={p.id} label={p.name} selected={course.projectId === p.id} onPress={() => update((x) => ({ ...x, projectId: p.id }))} />
            ))}
          </ChipRow>
        </>
      ) : null}

      <Button
        title="Delete course"
        variant="danger"
        onPress={() =>
          confirmDestructive('Delete this course?', 'Its lessons, study times and progress are deleted.', 'Delete', () => {
            c.remove(course.id);
            router.back();
          })
        }
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  big: { fontSize: 36, fontWeight: '800' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  overline: { fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  nextTitle: { fontSize: 18, fontWeight: '700' },
  markRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  markBtn: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  sectionTitle: { flex: 1, fontSize: 16, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '600', letterSpacing: 0.2 },
  swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 3 },
});
