import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FocusTimer } from '@/components/FocusTimer';
import { BarChart } from '@/components/gamedev/common';
import { ScreenHeader, SectionTitle } from '@/components/ui';
import { useCollege } from '@/hooks/useCollege';
import { useProjects } from '@/hooks/useProjects';
import { useTheme } from '@/hooks/useTheme';
import { upcomingExams } from '@/lib/college';
import { addDays, fromDateKey, toDateKey } from '@/lib/dates';
import { cardStats, cardsFor } from '@/lib/flashcards';
import { weekStart } from '@/lib/insights';
import { VERDICT_LABEL, examReadiness } from '@/lib/readiness';
import { studyBySubject } from '@/lib/study';
import { hours } from '@/lib/summary';

/** College study hub: study timer, hours per subject, and how ready you are for each exam. */
export default function StudyScreen() {
  const theme = useTheme();
  const { subject } = useLocalSearchParams<{ subject?: string }>();
  const { college } = useCollege();
  const p = useProjects();
  const [now] = useState(() => Date.now());
  const today = toDateKey(new Date());
  const monday = weekStart(today);
  const week = studyBySubject(p.state, fromDateKey(monday).getTime(), fromDateKey(addDays(monday, 7)).getTime());
  const total = [...week.values()].reduce((a, b) => a + b, 0);
  const exams = upcomingExams(college, today).slice(0, 6);

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <ScreenHeader title="Study" />
      <FocusTimer kind="study" initialSubjectId={subject} />

      <SectionTitle>{`This week · ${hours(total)}`}</SectionTitle>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {college.subjects.length ? (
          <BarChart values={college.subjects.map((s) => week.get(s.id) ?? 0)} labels={college.subjects.map((s) => s.short)} format={(v) => (v >= 60 ? `${Math.round((v / 60) * 10) / 10}h` : `${v}m`)} color={theme.accent} />
        ) : (
          <Text style={{ color: theme.muted }}>No subjects yet.</Text>
        )}
      </View>

      <SectionTitle>Exam readiness</SectionTitle>
      {exams.length === 0 ? <Text style={{ color: theme.muted }}>No upcoming exams.</Text> : null}
      {exams.map(({ exam, title, daysAway }) => {
        const r = examReadiness(college, p.state, exam, today, now);
        const cards = cardsFor(college.cards, { examId: exam.id }).length ? cardsFor(college.cards, { examId: exam.id }) : cardsFor(college.cards, { subjectId: exam.subjectId ?? '__none__' });
        const cs = cardStats(cards, today);
        const color = r.verdict === 'ready' ? theme.accent : r.verdict === 'getting-there' ? theme.primary : r.verdict === 'behind' ? theme.danger : theme.muted;
        return (
          <Pressable
            key={exam.id}
            onPress={() => router.push({ pathname: '/college/exam/[id]', params: { id: exam.id } })}
            accessibilityRole="button"
            accessibilityLabel={`${title}: ${r.score === null ? 'no readiness data' : `${r.score}% ready`}`}
            style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <View style={styles.row}>
              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16, flex: 1 }}>{title}</Text>
              <Text style={{ color, fontWeight: '800', fontSize: 18 }}>{r.score === null ? '—' : `${r.score}%`}</Text>
            </View>
            <Text style={{ color: theme.muted }}>
              {daysAway === 0 ? 'Today' : daysAway === 1 ? 'Tomorrow' : `In ${daysAway} days`} · {VERDICT_LABEL[r.verdict]}
              {cs.total ? ` · ${cs.due} card${cs.due === 1 ? '' : 's'} due` : ''}
            </Text>
            {r.tip ? <Text style={{ color: theme.text, fontSize: 13 }}>{r.tip}</Text> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
