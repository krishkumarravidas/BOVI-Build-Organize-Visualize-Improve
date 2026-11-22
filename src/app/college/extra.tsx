import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components/Button';
import { SubjectPicker } from '@/components/SubjectPicker';
import { Chip, ChipRow, DateField, ErrorText, Field, FormScreen, ScreenHeader, SectionTitle, TimeRangeFields, shortDate } from '@/components/ui';
import { useCollege } from '@/hooks/useCollege';
import { validateTimeRange } from '@/lib/college';
import { addDays, isValidDateKey, toDateKey } from '@/lib/dates';

/** Add a one-off class (extra lecture, rescheduled lab, doubt session...). */
export default function ExtraClassScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const c = useCollege();
  const today = toDateKey(new Date());
  const [date, setDate] = useState(params.date ?? today);
  const [subjectId, setSubjectId] = useState<string | undefined>();
  const [title, setTitle] = useState('');
  const [start, setStart] = useState('16:10');
  const [end, setEnd] = useState('17:05');
  const [room, setRoom] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    if (!isValidDateKey(date)) return setError('Use a date like 2026-11-21');
    if (!subjectId && !title.trim()) return setError('Pick a subject or enter a title');
    const err = validateTimeRange(start, end);
    if (err) return setError(err);
    c.addExtra({ date, start, end, subjectId, title: title.trim() || undefined, room: room.trim() || undefined, note: note.trim() || undefined });
    router.back();
  };

  return (
    <FormScreen>
      <ScreenHeader title="Add class" modal />
      <SectionTitle>Subject</SectionTitle>
      <SubjectPicker subjects={c.college.subjects} value={subjectId} onChange={setSubjectId} />
      <Field label="Title (optional)" value={title} onChangeText={setTitle} placeholder="e.g. Extra maths class" maxLength={60} />
      <SectionTitle>Day</SectionTitle>
      <ChipRow>
        {Array.from({ length: 14 }, (_, i) => addDays(today, i)).map((d) => (
          <Chip key={d} label={shortDate(d)} selected={d === date} onPress={() => setDate(d)} />
        ))}
      </ChipRow>
      <DateField label="Date" value={date} onChange={setDate} />
      <TimeRangeFields start={start} end={end} onStart={setStart} onEnd={setEnd} />
      <Field label="Room" value={room} onChangeText={setRoom} placeholder={c.college.defaultRoom} />
      <Field label="Note" value={note} onChangeText={setNote} placeholder="Optional" />
      <ErrorText>{error}</ErrorText>
      <Button title="Add class" onPress={save} />
    </FormScreen>
  );
}
