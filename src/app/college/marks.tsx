import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card, Field, ListRow, ScreenHeader, SectionTitle } from '@/components/ui';
import { useCollege } from '@/hooks/useCollege';
import { useTheme } from '@/hooks/useTheme';
import { subjectMarks } from '@/lib/collegeStats';

/** Numeric text field that commits valid numbers within a range. */
function NumberField({ label, value, onCommit, min, max, hint }: { label: string; value: number; onCommit: (n: number) => void; min: number; max: number; hint?: string }) {
  const [text, setText] = useState(String(value));
  return (
    <Field
      label={label}
      value={text}
      hint={hint}
      keyboardType="number-pad"
      maxLength={4}
      onChangeText={(t) => {
        setText(t);
        const n = Number(t);
        if (t.trim() && Number.isFinite(n) && n >= min && n <= max) onCommit(n);
      }}
    />
  );
}

export default function MarksScreen() {
  const theme = useTheme();
  const c = useCollege();
  const { college } = c;
  const g = college.grade;

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <ScreenHeader title="Marks & grades" />
      <Card>
        <Text style={{ color: theme.muted }}>How your final grade is made up (check your college&apos;s scheme):</Text>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <NumberField label="Internals %" value={g.internalWeight} min={0} max={100} onCommit={(n) => c.setGrade({ internalWeight: n })} />
          </View>
          <View style={{ flex: 1 }}>
            <NumberField label="Final out of" value={g.finalMax} min={1} max={1000} onCommit={(n) => c.setGrade({ finalMax: n })} />
          </View>
          <View style={{ flex: 1 }}>
            <NumberField label="Target %" value={g.target} min={1} max={100} onCommit={(n) => c.setGrade({ target: n })} />
          </View>
        </View>
      </Card>

      {college.subjects.map((subject) => {
        const entries = college.marks.filter((m) => m.subjectId === subject.id);
        const m = subjectMarks(entries, g);
        return (
          <View key={subject.id} style={{ gap: 8 }}>
            <SectionTitle
              right={<Button title="Add" variant="plain" onPress={() => router.push({ pathname: '/college/mark/[id]', params: { id: 'new', subjectId: subject.id } })} />}
            >
              {subject.short}
            </SectionTitle>
            {entries.length === 0 ? (
              <Text style={{ color: theme.muted }}>No marks yet.</Text>
            ) : (
              <>
                {entries.map((e) => (
                  <ListRow
                    key={e.id}
                    title={`${e.label}: ${e.scored}/${e.outOf}`}
                    color={subject.color}
                    onPress={() => router.push({ pathname: '/college/mark/[id]', params: { id: e.id } })}
                  />
                ))}
                <Text style={{ color: theme.text, fontWeight: '600' }}>
                  Internals {m.scored}/{m.outOf} ({Math.round(m.percent ?? 0)}%)
                </Text>
                {m.neededInFinal !== null ? (
                  <Text style={{ color: m.neededInFinal > g.finalMax ? theme.danger : theme.muted }}>
                    {m.neededInFinal > g.finalMax
                      ? `${g.target}% overall isn't reachable even with full marks in the final.`
                      : m.neededInFinal === 0
                        ? `${g.target}% overall is already covered by internals.`
                        : `Need ${m.neededInFinal}/${g.finalMax} in the final for ${g.target}% overall.`}
                  </Text>
                ) : null}
              </>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 10, paddingBottom: 40 },
  row: { flexDirection: 'row', gap: 10 },
});
