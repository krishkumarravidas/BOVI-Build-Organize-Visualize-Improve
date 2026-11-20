import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { Button } from '@/components/Button';
import { SubjectPicker } from '@/components/SubjectPicker';
import { Chip, ChipRow, ErrorText, Field, FormScreen, ScreenHeader, SectionTitle, TimeRangeFields, confirmDestructive } from '@/components/ui';
import { newId, useCollege } from '@/hooks/useCollege';
import { useTheme } from '@/hooks/useTheme';
import { validateSlot } from '@/lib/college';
import type { Weekday } from '@/lib/types';

const DAY_LABELS: [Weekday, string][] = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [0, 'Sun']];

export default function SlotFormScreen() {
  const { id, day: dayParam } = useLocalSearchParams<{ id: string; day?: string }>();
  const theme = useTheme();
  const c = useCollege();
  const existing = id === 'new' ? undefined : c.college.slots.find((s) => s.id === id);

  const [subjectId, setSubjectId] = useState(existing?.subjectId);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [day, setDay] = useState<Weekday>(existing?.day ?? ((Number(dayParam) || 1) as Weekday));
  const [start, setStart] = useState(existing?.start ?? '08:30');
  const [end, setEnd] = useState(existing?.end ?? '09:25');
  const [room, setRoom] = useState(existing?.room ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState<string | null>(null);

  if (id !== 'new' && !existing) {
    return (
      <FormScreen>
        <ScreenHeader title="Class" modal />
        <Text style={{ color: theme.muted }}>This class no longer exists.</Text>
      </FormScreen>
    );
  }

  const save = () => {
    const slot = {
      id: existing?.id ?? newId(),
      day,
      start,
      end,
      subjectId,
      title: title.trim() || undefined,
      room: room.trim() || undefined,
      note: note.trim() || undefined,
    };
    const err = validateSlot(slot);
    if (err) return setError(err);
    c.upsertSlot(slot);
    router.back();
  };

  return (
    <FormScreen>
      <ScreenHeader title={existing ? 'Edit class' : 'New class'} modal />
      <SectionTitle>Subject</SectionTitle>
      <SubjectPicker subjects={c.college.subjects} value={subjectId} onChange={setSubjectId} />
      <Field label="Title (optional)" value={title} onChangeText={setTitle} placeholder="e.g. OOPS Tutorial, Proctoring" maxLength={60} hint="Overrides the subject name, or names a non-subject slot." />
      <SectionTitle>Day</SectionTitle>
      <ChipRow>
        {DAY_LABELS.map(([d, l]) => (
          <Chip key={d} label={l} selected={d === day} onPress={() => setDay(d)} />
        ))}
      </ChipRow>
      <TimeRangeFields start={start} end={end} onStart={setStart} onEnd={setEnd} />
      <Field label="Room" value={room} onChangeText={setRoom} placeholder={`Default: ${c.college.defaultRoom || 'none'}`} />
      <Field label="Note" value={note} onChangeText={setNote} placeholder="Optional, e.g. batch or lab details" multiline />
      <ErrorText>{error}</ErrorText>
      <Button title="Save" onPress={save} />
      {existing ? (
        <Button
          title="Delete from timetable"
          variant="danger"
          onPress={() =>
            confirmDestructive('Delete class?', 'It will be removed from every week.', 'Delete', () => {
              c.deleteSlot(existing.id);
              router.back();
            })
          }
        />
      ) : null}
    </FormScreen>
  );
}
