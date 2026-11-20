import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { SubjectPicker } from '@/components/SubjectPicker';
import { ErrorText, Field, FormScreen, ScreenHeader, SectionTitle, confirmDestructive } from '@/components/ui';
import { newId, useCollege } from '@/hooks/useCollege';
import { useTheme } from '@/hooks/useTheme';
import { validateMark } from '@/lib/collegeStats';

export default function MarkFormScreen() {
  const { id, subjectId: subjectParam } = useLocalSearchParams<{ id: string; subjectId?: string }>();
  const theme = useTheme();
  const c = useCollege();
  const existing = id === 'new' ? undefined : c.college.marks.find((m) => m.id === id);

  const [subjectId, setSubjectId] = useState(existing?.subjectId ?? subjectParam);
  const [label, setLabel] = useState(existing?.label ?? 'IA1');
  const [scored, setScored] = useState(existing ? String(existing.scored) : '');
  const [outOf, setOutOf] = useState(existing ? String(existing.outOf) : '25');
  const [error, setError] = useState<string | null>(null);

  if (id !== 'new' && !existing) {
    return (
      <FormScreen>
        <ScreenHeader title="Marks" modal />
        <Text style={{ color: theme.muted }}>This entry no longer exists.</Text>
      </FormScreen>
    );
  }

  const save = () => {
    if (!subjectId) return setError('Pick a subject');
    const entry = { id: existing?.id ?? newId(), subjectId, label: label.trim(), scored: Number(scored), outOf: Number(outOf) };
    const err = validateMark(entry);
    if (err) return setError(err);
    c.upsertMark(entry);
    router.back();
  };

  return (
    <FormScreen>
      <ScreenHeader title={existing ? 'Edit marks' : 'Add marks'} modal />
      <SectionTitle>Subject</SectionTitle>
      <SubjectPicker subjects={c.college.subjects} value={subjectId} onChange={setSubjectId} />
      <Field label="Component" value={label} onChangeText={setLabel} placeholder="e.g. IA1, Lab record, Quiz" maxLength={30} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Field label="Scored" value={scored} onChangeText={setScored} keyboardType="decimal-pad" maxLength={6} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Out of" value={outOf} onChangeText={setOutOf} keyboardType="decimal-pad" maxLength={6} />
        </View>
      </View>
      <ErrorText>{error}</ErrorText>
      <Button title="Save" onPress={save} />
      {existing ? (
        <Button
          title="Delete entry"
          variant="danger"
          onPress={() =>
            confirmDestructive('Delete marks?', 'This cannot be undone.', 'Delete', () => {
              c.deleteMark(existing.id);
              router.back();
            })
          }
        />
      ) : null}
    </FormScreen>
  );
}
