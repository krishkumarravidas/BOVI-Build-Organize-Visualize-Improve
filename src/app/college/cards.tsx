import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { AddPanel, Stat, StatRow } from '@/components/gamedev/common';
import { Chip, ChipRow, EmptyText, ErrorText, Field, ScreenHeader, SectionTitle, confirmDestructive } from '@/components/ui';
import { newId, useCollege } from '@/hooks/useCollege';
import { useTheme } from '@/hooks/useTheme';
import { toDateKey } from '@/lib/dates';
import { cardStats, cardsFor, newCard, removeCard, upsertCard } from '@/lib/flashcards';

/** Flashcards for a subject or an exam: add (optionally from a syllabus topic), browse, start a review. */
export default function CardsScreen() {
  const theme = useTheme();
  const { subject: subjectParam, exam: examParam } = useLocalSearchParams<{ subject?: string; exam?: string }>();
  const c = useCollege();
  const exam = c.college.exams.find((e) => e.id === examParam);
  const subjectId = subjectParam ?? exam?.subjectId;
  const subject = c.college.subjects.find((s) => s.id === subjectId);
  const today = toDateKey(new Date());
  const filter = exam ? { examId: exam.id } : { subjectId };
  const cards = cardsFor(c.college.cards, filter);
  const st = cardStats(cards, today);
  const title = exam ? `${subject?.short ?? exam.title ?? 'Exam'} ${exam.series}` : (subject?.short ?? 'Flashcards');
  const topics = exam?.topics ?? [];

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <ScreenHeader title={`${title}: flashcards`} />
      <StatRow>
        <Stat value={String(st.total)} label="cards" />
        <Stat value={String(st.due)} label="due today" color={st.due ? theme.primary : theme.text} />
        <Stat value={String(st.mastered)} label="known" color={theme.accent} />
      </StatRow>
      <Button
        title={st.due ? `Review ${st.due} due card${st.due === 1 ? '' : 's'}` : 'Nothing due — review all'}
        onPress={() => router.push({ pathname: '/college/review', params: { ...(exam ? { exam: exam.id } : {}), ...(subjectId ? { subject: subjectId } : {}), ...(st.due ? {} : { all: '1' }) } })}
        disabled={!st.total}
      />
      <Text style={{ color: theme.muted, fontSize: 13 }}>Right answers come back later (1 → 2 → 4 → 8 → 16 days); misses come back tomorrow.</Text>
      <AddPanel label="Add card">
        {(close) => (
          <CardForm
            topics={topics}
            onAdd={(front, back, topicId) =>
              c.apply((s) => upsertCard(s, newCard({ id: newId(), front, back, ...(subjectId ? { subjectId } : {}), ...(exam ? { examId: exam.id } : {}), ...(topicId ? { topicId } : {}) }, today)))
            }
            onClose={close}
          />
        )}
      </AddPanel>
      <SectionTitle>{`${cards.length} card${cards.length === 1 ? '' : 's'}`}</SectionTitle>
      {cards.length === 0 ? <EmptyText>No cards yet. One question per card: a definition, a formula, a “why”.</EmptyText> : null}
      {cards.map((card) => (
        <Pressable
          key={card.id}
          onLongPress={() => confirmDestructive('Delete card?', card.front, 'Delete', () => c.apply((s) => removeCard(s, card.id)))}
          accessibilityHint="Long-press to delete"
          style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <Text style={{ color: theme.text, fontWeight: '700' }}>{card.front}</Text>
          <Text style={{ color: theme.muted }}>{card.back}</Text>
          <Text style={{ color: theme.muted, fontSize: 12 }}>
            Box {card.box} · next {card.due <= today ? 'today' : card.due}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function CardForm({ topics, onAdd, onClose }: { topics: { id: string; title: string }[]; onAdd: (front: string, back: string, topicId?: string) => void; onClose: () => void }) {
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [topicId, setTopicId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const add = () => {
    if (!front.trim() || !back.trim()) return setError('Write both the question and the answer');
    onAdd(front, back, topicId);
    setFront('');
    setBack('');
    setError(null);
  };
  return (
    <>
      {topics.length ? (
        <ChipRow>
          {topics.map((t) => (
            <Chip
              key={t.id}
              label={t.title.length > 28 ? `${t.title.slice(0, 27)}…` : t.title}
              selected={topicId === t.id}
              onPress={() => {
                setTopicId(t.id);
                if (!front.trim()) setFront(`${t.title}: `);
              }}
            />
          ))}
        </ChipRow>
      ) : null}
      <Field label="Question" value={front} onChangeText={setFront} placeholder="e.g. Time complexity of BFS?" autoFocus multiline />
      <Field label="Answer" value={back} onChangeText={setBack} placeholder="e.g. O(V + E)" multiline />
      <ErrorText>{error}</ErrorText>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Button title="Done" variant="plain" onPress={onClose} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Add card" onPress={add} />
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  card: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 4 },
});
