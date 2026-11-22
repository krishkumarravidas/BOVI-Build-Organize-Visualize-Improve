import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { LinkList } from '@/components/LinkList';
import { SubjectPicker } from '@/components/SubjectPicker';
import { Card, Chip, ChipRow, DateField, ErrorText, Field, FormScreen, ScreenHeader, SectionTitle, TimeRangeFields, confirmDestructive, shortDate } from '@/components/ui';
import { useCalendarEvents } from '@/hooks/useCalendarEvents';
import { useHabits } from '@/hooks/useHabits';
import { newId, useCollege } from '@/hooks/useCollege';
import { useProjects } from '@/hooks/useProjects';
import { useTheme } from '@/hooks/useTheme';
import { cardStats, cardsFor } from '@/lib/flashcards';
import { VERDICT_LABEL, examReadiness } from '@/lib/readiness';
import { validateTimeRange, type Exam, type StudySession } from '@/lib/college';
import type { ProjectsState } from '@/lib/projects';
import { topicProgress } from '@/lib/collegeStats';
import { planRevision } from '@/lib/studyPlan';
import { daysBetween, isValidDateKey, toDateKey } from '@/lib/dates';

export default function ExamFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const c = useCollege();
  const existing = id === 'new' ? undefined : c.college.exams.find((e) => e.id === id);

  const [series, setSeries] = useState(existing?.series ?? 'IA2');
  const [subjectId, setSubjectId] = useState(existing?.subjectId);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [date, setDate] = useState(existing?.date ?? toDateKey(new Date()));
  const [start, setStart] = useState(existing?.start ?? '');
  const [end, setEnd] = useState(existing?.end ?? '');
  const [room, setRoom] = useState(existing?.room ?? '');
  const [syllabus, setSyllabus] = useState(existing?.syllabus ?? '');
  const [error, setError] = useState<string | null>(null);
  const [newTopic, setNewTopic] = useState('');
  const [sessions, setSessions] = useState(3);
  const [minutes, setMinutes] = useState(60);
  const [preview, setPreview] = useState<StudySession[] | null>(null);
  const { state: projectsState } = useProjects();
  const [now] = useState(() => Date.now());
  const { state: habitState } = useHabits();
  const daysAhead = existing ? Math.min(30, Math.max(1, daysBetween(toDateKey(new Date()), existing.date) + 1)) : 1;
  const calendar = useCalendarEvents(daysAhead);

  if (id !== 'new' && !existing) {
    return (
      <FormScreen>
        <ScreenHeader title="Exam" modal />
        <Text style={{ color: theme.muted }}>This exam no longer exists.</Text>
      </FormScreen>
    );
  }

  const save = () => {
    if (!series.trim()) return setError('Enter the exam name, e.g. IA2');
    if (!subjectId && !title.trim()) return setError('Pick a subject or enter a title');
    if (!isValidDateKey(date)) return setError('Use a date like 2026-11-16');
    if (start || end) {
      const err = validateTimeRange(start, end);
      if (err) return setError(`${err} (or leave both times empty)`);
    }
    c.upsertExam({
      id: existing?.id ?? newId(),
      series: series.trim(),
      subjectId,
      title: title.trim() || undefined,
      date,
      start: start || undefined,
      end: end || undefined,
      room: room.trim() || undefined,
      syllabus: syllabus.trim() || undefined,
      // Topics are edited live below; keep the latest stored list.
      topics: c.college.exams.find((e) => e.id === existing?.id)?.topics ?? [],
    });
    router.back();
  };

  const topics = existing?.topics ?? [];
  const addTopic = () => {
    if (!existing || !newTopic.trim()) return;
    c.upsertExam({ ...existing, topics: [...topics, { id: newId(), title: newTopic.trim(), done: false }] });
    setNewTopic('');
  };
  const removeTopic = (topicId: string) => existing && c.upsertExam({ ...existing, topics: topics.filter((t) => t.id !== topicId) });
  const examSessions = existing ? c.college.study.filter((s) => s.examId === existing.id).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)) : [];
  const upcoming = existing ? existing.date >= toDateKey(new Date()) : false;
  const makePlan = () => {
    if (!existing) return;
    setPreview(planRevision(existing, c.college, habitState.blocks, calendar.events, { sessions, minutes, now: new Date() }, newId));
  };

  const subjectLinks = c.college.subjects.find((x) => x.id === subjectId)?.links ?? [];

  return (
    <FormScreen>
      <ScreenHeader title={existing ? 'Edit exam' : 'New exam'} modal />
      <Field label="Exam" value={series} onChangeText={setSeries} placeholder="e.g. IA1, IA2, SEE" maxLength={20} />
      <SectionTitle>Subject</SectionTitle>
      <SubjectPicker subjects={c.college.subjects} value={subjectId} onChange={setSubjectId} />
      {subjectLinks.length ? (
        <>
          <SectionTitle>Study links</SectionTitle>
          <LinkList links={subjectLinks} />
        </>
      ) : null}
      <Field label="Title (optional)" value={title} onChangeText={setTitle} placeholder="Overrides the subject name" maxLength={60} />
      <DateField label="Date" value={date} onChange={setDate} />
      <TimeRangeFields start={start} end={end} onStart={setStart} onEnd={setEnd} />
      <Field label="Room" value={room} onChangeText={setRoom} placeholder="Optional" />
      <Field label="Syllabus / portions" value={syllabus} onChangeText={setSyllabus} placeholder="e.g. Modules 1–2" multiline />
      <ErrorText>{error}</ErrorText>
      <Button title="Save" onPress={save} />

      {existing ? <ReadinessCard exam={existing} projectsState={projectsState} now={now} /> : null}

      {existing ? (
        <>
          <SectionTitle>{`Syllabus checklist${topics.length ? ` · ${topicProgress(existing).done}/${topics.length}` : ''}`}</SectionTitle>
          {topics.map((t) => (
            <View key={t.id} style={styles.taskRow}>
              <Pressable
                onPress={() => c.toggleTopic(existing.id, t.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: t.done }}
                accessibilityLabel={t.title}
                style={[styles.check, { borderColor: theme.primary, backgroundColor: t.done ? theme.primary : 'transparent' }]}
              >
                {t.done ? <Ionicons name="checkmark" size={16} color={theme.onPrimary} /> : null}
              </Pressable>
              <Text style={[styles.taskText, { color: t.done ? theme.muted : theme.text }, t.done && styles.strike]}>{t.title}</Text>
              <Pressable onPress={() => removeTopic(t.id)} accessibilityRole="button" accessibilityLabel={`Delete topic ${t.title}`} hitSlop={8}>
                <Ionicons name="close" size={20} color={theme.muted} />
              </Pressable>
            </View>
          ))}
          <View style={styles.taskRow}>
            <TextInput
              value={newTopic}
              onChangeText={setNewTopic}
              onSubmitEditing={addTopic}
              placeholder="Add a topic, e.g. Module 3"
              placeholderTextColor={theme.muted}
              accessibilityLabel="New topic"
              returnKeyType="done"
              style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
            />
            <Button title="Add" variant="plain" onPress={addTopic} />
          </View>

          {upcoming ? (
            <>
              <SectionTitle>Plan revision</SectionTitle>
              <Text style={{ color: theme.muted }}>Finds free slots before the exam (weekday evenings, weekend days), avoiding classes, blocks and calendar events.</Text>
              <ChipRow>
                {[2, 3, 4, 5].map((n) => (
                  <Chip key={n} label={`${n} sessions`} selected={sessions === n} onPress={() => { setSessions(n); setPreview(null); }} />
                ))}
              </ChipRow>
              <ChipRow>
                {[45, 60, 90].map((m) => (
                  <Chip key={m} label={`${m} min`} selected={minutes === m} onPress={() => { setMinutes(m); setPreview(null); }} />
                ))}
              </ChipRow>
              <Button title="Preview plan" variant="plain" onPress={makePlan} />
              {preview ? (
                <Card>
                  {preview.length === 0 ? (
                    <Text style={{ color: theme.muted }}>No free slots found before the exam.</Text>
                  ) : (
                    preview.map((p) => (
                      <Text key={p.id} style={{ color: theme.text }}>
                        {shortDate(p.date)} · {p.start}–{p.end} · {p.title}
                      </Text>
                    ))
                  )}
                  {preview.length > 0 ? (
                    <Button
                      title={`Add ${preview.length} to schedule`}
                      onPress={() => {
                        c.addStudy(preview);
                        setPreview(null);
                      }}
                    />
                  ) : null}
                  {preview.length > 0 && preview.length < sessions ? (
                    <Text style={{ color: theme.muted }}>Only found room for {preview.length} of {sessions}.</Text>
                  ) : null}
                </Card>
              ) : null}
            </>
          ) : null}

          {examSessions.length ? <SectionTitle>Revision sessions</SectionTitle> : null}
          {examSessions.map((s) => (
            <View key={s.id} style={styles.taskRow}>
              <Pressable
                onPress={() => c.toggleStudy(s.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: s.done }}
                accessibilityLabel={`${s.title} ${shortDate(s.date)}`}
                style={[styles.check, { borderColor: theme.accent, backgroundColor: s.done ? theme.accent : 'transparent' }]}
              >
                {s.done ? <Ionicons name="checkmark" size={16} color={theme.background} /> : null}
              </Pressable>
              <Text style={[styles.taskText, { color: s.done ? theme.muted : theme.text }, s.done && styles.strike]}>
                {shortDate(s.date)} · {s.start}–{s.end}
                {'\n'}
                <Text style={{ color: theme.muted }}>{s.title}</Text>
              </Text>
              <Pressable onPress={() => c.deleteStudy(s.id)} accessibilityRole="button" accessibilityLabel={`Delete session ${shortDate(s.date)} ${s.start}`} hitSlop={8}>
                <Ionicons name="close" size={20} color={theme.muted} />
              </Pressable>
            </View>
          ))}
        </>
      ) : null}
      {existing ? (
        <Button
          title="Delete exam"
          variant="danger"
          onPress={() =>
            confirmDestructive('Delete exam?', 'This cannot be undone.', 'Delete', () => {
              c.deleteExam(existing.id);
              router.back();
            })
          }
        />
      ) : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  check: { width: 26, height: 26, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  taskText: { flex: 1, fontSize: 16 },
  strike: { textDecorationLine: 'line-through' },
  input: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
});

function ReadinessCard({ exam, projectsState, now }: { exam: Exam; projectsState: ProjectsState; now: number }) {
  const theme = useTheme();
  const { college } = useCollege();
  const today = toDateKey(new Date());
  const r = examReadiness(college, projectsState, exam, today, now);
  const examCards = cardsFor(college.cards, { examId: exam.id });
  const cs = cardStats(examCards, today);
  const color = r.verdict === 'ready' ? theme.accent : r.verdict === 'getting-there' ? theme.primary : r.verdict === 'behind' ? theme.danger : theme.muted;
  return (
    <>
      <SectionTitle>Readiness</SectionTitle>
      <Card>
        <Text style={{ color, fontSize: 22, fontWeight: '800' }}>
          {r.score === null ? 'No data yet' : `${r.score}% · ${VERDICT_LABEL[r.verdict]}`}
        </Text>
        {r.parts.map((p) => (
          <View key={p.key} style={{ gap: 3 }}>
            <View style={{ flexDirection: 'row' }}>
              <Text style={{ color: theme.text, flex: 1 }}>{p.label}</Text>
              <Text style={{ color: theme.muted }}>{p.detail}</Text>
            </View>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.border, overflow: 'hidden' }}>
              <View style={{ width: `${Math.round(p.value * 100)}%`, height: 6, backgroundColor: color }} />
            </View>
          </View>
        ))}
        {r.tip ? <Text style={{ color: theme.muted }}>{r.tip}</Text> : null}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Button title="Study now" variant="plain" onPress={() => router.push({ pathname: '/study', params: exam.subjectId ? { subject: exam.subjectId } : {} })} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title={cs.total ? `Flashcards (${cs.due} due)` : 'Flashcards'} variant="plain" onPress={() => router.push({ pathname: '/college/cards', params: { exam: exam.id } })} />
          </View>
        </View>
      </Card>
    </>
  );
}
