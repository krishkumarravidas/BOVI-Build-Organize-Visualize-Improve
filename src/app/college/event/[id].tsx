import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { Button } from '@/components/Button';
import { ErrorText, Field, FormScreen, ScreenHeader, confirmDestructive } from '@/components/ui';
import { newId, useCollege } from '@/hooks/useCollege';
import { useTheme } from '@/hooks/useTheme';
import { isValidDateKey, toDateKey } from '@/lib/dates';

export default function EventFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const c = useCollege();
  const existing = id === 'new' ? undefined : c.college.events.find((e) => e.id === id);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [startDate, setStartDate] = useState(existing?.startDate ?? toDateKey(new Date()));
  const [endDate, setEndDate] = useState(existing?.endDate ?? toDateKey(new Date()));
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState<string | null>(null);

  if (id !== 'new' && !existing) {
    return (
      <FormScreen>
        <ScreenHeader title="Event" modal />
        <Text style={{ color: theme.muted }}>This event no longer exists.</Text>
      </FormScreen>
    );
  }

  const save = () => {
    if (!title.trim()) return setError('Enter a title');
    if (!isValidDateKey(startDate) || !isValidDateKey(endDate)) return setError('Use dates like 2026-11-19');
    if (endDate < startDate) return setError('End date must be on or after the start date');
    c.upsertEvent({ id: existing?.id ?? newId(), title: title.trim(), startDate, endDate, note: note.trim() || undefined });
    router.back();
  };

  return (
    <FormScreen>
      <ScreenHeader title={existing ? 'Edit event' : 'New event'} modal />
      <Field label="Title" value={title} onChangeText={setTitle} placeholder="e.g. XR Workshop" maxLength={80} />
      <Field label="Start date" value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" autoCapitalize="none" />
      <Field label="End date" value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" autoCapitalize="none" />
      <Field label="Note" value={note} onChangeText={setNote} placeholder="Optional" multiline />
      <ErrorText>{error}</ErrorText>
      <Button title="Save" onPress={save} />
      {existing ? (
        <Button
          title="Delete event"
          variant="danger"
          onPress={() =>
            confirmDestructive('Delete event?', 'This cannot be undone.', 'Delete', () => {
              c.deleteEvent(existing.id);
              router.back();
            })
          }
        />
      ) : null}
    </FormScreen>
  );
}
