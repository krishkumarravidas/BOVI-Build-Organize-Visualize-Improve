import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { Button } from '@/components/Button';
import { SubjectPicker } from '@/components/SubjectPicker';
import { Chip, ChipRow, ErrorText, Field, FormScreen, ScreenHeader, SectionTitle, confirmDestructive, shortDate } from '@/components/ui';
import { newId, useCollege } from '@/hooks/useCollege';
import { useTheme } from '@/hooks/useTheme';
import { addDays, isValidDateKey, toDateKey } from '@/lib/dates';

export default function AssignmentFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const c = useCollege();
  const existing = id === 'new' ? undefined : c.college.assignments.find((a) => a.id === id);
  const today = toDateKey(new Date());

  const [title, setTitle] = useState(existing?.title ?? '');
  const [subjectId, setSubjectId] = useState(existing?.subjectId);
  const [due, setDue] = useState(existing?.due ?? addDays(today, 3));
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  if (id !== 'new' && !existing) {
    return (
      <FormScreen>
        <ScreenHeader title="Assignment" modal />
        <Text style={{ color: theme.muted }}>This assignment no longer exists.</Text>
      </FormScreen>
    );
  }

  const save = () => {
    if (!title.trim()) return setError('Enter a title');
    if (!isValidDateKey(due)) return setError('Use a date like 2026-11-20');
    c.upsertAssignment({ id: existing?.id ?? newId(), title: title.trim(), subjectId, due, done: existing?.done ?? false, notes: notes.trim() || undefined });
    router.back();
  };

  return (
    <FormScreen>
      <ScreenHeader title={existing ? 'Edit assignment' : 'New assignment'} modal />
      <Field label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Lab record" maxLength={100} />
      <SectionTitle>Subject</SectionTitle>
      <SubjectPicker subjects={c.college.subjects} value={subjectId} onChange={setSubjectId} />
      <SectionTitle>Due</SectionTitle>
      <ChipRow>
        {Array.from({ length: 14 }, (_, i) => addDays(today, i)).map((d) => (
          <Chip key={d} label={shortDate(d)} selected={d === due} onPress={() => setDue(d)} />
        ))}
      </ChipRow>
      <Field label="Due date" value={due} onChangeText={setDue} placeholder="YYYY-MM-DD" autoCapitalize="none" />
      <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional" multiline />
      <ErrorText>{error}</ErrorText>
      <Button title="Save" onPress={save} />
      {existing ? (
        <Button
          title="Delete assignment"
          variant="danger"
          onPress={() =>
            confirmDestructive('Delete assignment?', 'This cannot be undone.', 'Delete', () => {
              c.deleteAssignment(existing.id);
              router.back();
            })
          }
        />
      ) : null}
    </FormScreen>
  );
}
