import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { ScreenHeader } from '@/components/ui';
import { useCollege } from '@/hooks/useCollege';
import { useTheme } from '@/hooks/useTheme';
import type { Flashcard } from '@/lib/college';
import { toDateKey } from '@/lib/dates';
import { cardsFor, dueCards, reviewCard, upsertCard } from '@/lib/flashcards';

/** One card at a time: think of the answer, reveal, then say whether you got it. */
export default function ReviewScreen() {
  const theme = useTheme();
  const { subject, exam, all } = useLocalSearchParams<{ subject?: string; exam?: string; all?: string }>();
  const c = useCollege();
  const today = toDateKey(new Date());
  // The session's deck is fixed when it starts, so reviewed cards don't reshuffle under you.
  const [deck] = useState<Flashcard[]>(() => {
    const pool = cardsFor(c.college.cards, exam ? { examId: exam } : { subjectId: subject });
    return all ? [...pool].sort((a, b) => a.box - b.box) : dueCards(pool, today);
  });
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(false);
  const [right, setRight] = useState(0);
  const card = deck[index];

  const answer = (correct: boolean) => {
    if (!card) return;
    c.apply((s) => upsertCard(s, reviewCard(card, correct, today, Date.now())));
    if (correct) setRight((r) => r + 1);
    setShown(false);
    setIndex((i) => i + 1);
  };

  if (!card) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <ScreenHeader title="Review" />
        <Text style={[styles.big, { color: theme.text }]}>{deck.length ? 'Done!' : 'Nothing due'}</Text>
        {deck.length ? (
          <Text style={{ color: theme.muted, fontSize: 16 }}>
            {right} of {deck.length} right. Missed cards come back tomorrow.
          </Text>
        ) : (
          <Text style={{ color: theme.muted }}>All caught up. Come back tomorrow.</Text>
        )}
        <Button title="Back" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScreenHeader title={`Review · ${index + 1}/${deck.length}`} />
      <Pressable
        onPress={() => setShown(true)}
        accessibilityRole="button"
        accessibilityLabel={shown ? `${card.front}. Answer: ${card.back}` : `${card.front}. Tap to show the answer`}
        style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
      >
        <Text style={[styles.front, { color: theme.text }]}>{card.front}</Text>
        {shown ? <Text style={[styles.back, { color: theme.accent }]}>{card.back}</Text> : <Text style={{ color: theme.muted }}>Tap to show the answer</Text>}
      </Pressable>
      {shown ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Button title="Missed it" variant="danger" onPress={() => answer(false)} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Got it" onPress={() => answer(true)} />
          </View>
        </View>
      ) : (
        <Button title="Show answer" onPress={() => setShown(true)} />
      )}
      <Text style={{ color: theme.muted, textAlign: 'center' }}>Box {card.box}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16, gap: 14 },
  card: { minHeight: 240, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 20, gap: 16, justifyContent: 'center' },
  front: { fontSize: 22, fontWeight: '700' },
  back: { fontSize: 20, fontWeight: '600' },
  big: { fontSize: 28, fontWeight: '800' },
});
