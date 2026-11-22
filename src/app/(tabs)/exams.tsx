import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/Button';
import { EmptyText, KeyboardScroll, ListRow, SectionTitle, shortDate } from '@/components/ui';
import { useCollege } from '@/hooks/useCollege';
import { useProjects } from '@/hooks/useProjects';
import { useTheme } from '@/hooks/useTheme';
import { countdownLabel, subjectName, upcomingExams } from '@/lib/college';
import { topicProgress } from '@/lib/collegeStats';
import { toDateKey } from '@/lib/dates';
import { examReadiness } from '@/lib/readiness';

export default function ExamsTab() {
  const theme = useTheme();
  const { college } = useCollege();
  const { state: projects } = useProjects();
  const [now] = useState(() => Date.now());
  const today = toDateKey(new Date());
  const upcoming = upcomingExams(college, today);
  const past = college.exams.filter((e) => e.date < today).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <KeyboardScroll style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      <ListRow title="Study timer & readiness" subtitle="Study a subject, see how ready you are for each exam" color={theme.primary} onPress={() => router.push('/study')} />
      <SectionTitle>Upcoming</SectionTitle>
      {upcoming.length === 0 ? <EmptyText>No upcoming exams.</EmptyText> : null}
      {upcoming.map(({ exam, title, daysAway, clashes }) => {
        const r = examReadiness(college, projects, exam, today, now);
        return (
          <ListRow
          key={exam.id}
          title={`${title} · ${exam.series}`}
          subtitle={`${countdownLabel(daysAway)} · ${shortDate(exam.date)}${exam.start ? ` · ${exam.start}–${exam.end ?? ''}` : ' · time TBA'}`}
          detail={[
            clashes.length ? `Clashes with ${clashes.join(', ')}` : '',
            topicProgress(exam).total ? `Topics ${topicProgress(exam).done}/${topicProgress(exam).total} revised` : '',
            exam.syllabus ?? '',
          ]
            .filter(Boolean)
            .join('\n')}
          color={college.subjects.find((s) => s.id === exam.subjectId)?.color ?? theme.danger}
          badge={
            clashes.length
              ? { text: 'Clash', tone: 'danger' }
              : r.score !== null
                ? { text: `${r.score}% ready`, tone: r.verdict === 'ready' ? 'accent' : r.verdict === 'behind' ? 'danger' : 'muted' }
                : undefined
          }
          onPress={() => router.push({ pathname: '/college/exam/[id]', params: { id: exam.id } })}
        />
        );
      })}
      <Button title="Add exam" onPress={() => router.push({ pathname: '/college/exam/[id]', params: { id: 'new' } })} />
      <ListRow title="Marks & grades" subtitle="IA marks and what you need in the final" color={theme.accent} onPress={() => router.push('/college/marks')} />
      {past.length > 0 ? <SectionTitle>Past</SectionTitle> : null}
      {past.map((exam) => (
        <ListRow
          key={exam.id}
          title={`${subjectName(college, exam.subjectId, exam.title)} · ${exam.series}`}
          subtitle={shortDate(exam.date)}
          muted
          color={theme.muted}
          onPress={() => router.push({ pathname: '/college/exam/[id]', params: { id: exam.id } })}
        />
      ))}
    </KeyboardScroll>
  );
}

const styles = StyleSheet.create({ content: { padding: 16, gap: 10, paddingBottom: 40 } });
