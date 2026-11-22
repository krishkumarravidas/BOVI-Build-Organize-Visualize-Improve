import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Switch, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip, ChipRow, DateField, ErrorText, Field, FormScreen, ScreenHeader, SectionTitle, TimeField, confirmDestructive } from '@/components/ui';
import { useHabits } from '@/hooks/useHabits';
import { newId } from '@/hooks/useCollege';
import { useTheme } from '@/hooks/useTheme';
import { addDays, isValidDateKey, toDateKey } from '@/lib/dates';
import { TASK_DURATIONS, removeTodo, setTodoDone, upsertTodo } from '@/lib/todos';
import type { Todo } from '@/lib/types';

const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

/** Add or edit a one-off task: a day, an optional time (then it's on the dial), length and reminder. */
export default function TaskScreen() {
  const { id, date: dateParam, time: timeParam } = useLocalSearchParams<{ id: string; date?: string; time?: string }>();
  const theme = useTheme();
  const { state, apply } = useHabits();
  const existing = id === 'new' ? undefined : state.todos?.find((t) => t.id === id);
  const today = toDateKey(new Date());
  const [title, setTitle] = useState(existing?.title ?? '');
  const [date, setDate] = useState(existing?.date ?? (dateParam && isValidDateKey(dateParam) ? dateParam : today));
  const [time, setTime] = useState(existing?.time ?? timeParam ?? '');
  const [minutes, setMinutes] = useState(existing?.minutes ?? 30);
  const [remind, setRemind] = useState(existing?.remind ?? true);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  if (id !== 'new' && !existing) {
    return (
      <FormScreen>
        <ScreenHeader title="Task" modal />
        <Text style={{ color: theme.muted }}>This task no longer exists.</Text>
      </FormScreen>
    );
  }

  const save = () => {
    if (!title.trim()) return setError('What’s the task?');
    if (!isValidDateKey(date)) return setError('Use a date like 2026-11-20');
    const t = time.trim();
    if (t && !TIME_RE.test(t)) return setError('Time like 17:30 (24h), or leave it empty');
    const todo: Todo = {
      id: existing?.id ?? newId(),
      title: title.trim(),
      date,
      done: existing?.done ?? false,
      ...(existing?.doneAt ? { doneAt: existing.doneAt } : {}),
      ...(t ? { time: t.padStart(5, '0'), minutes, remind } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };
    apply((s) => upsertTodo(s, todo));
    router.back();
  };

  const dayChips = [
    { label: 'Today', value: today },
    { label: 'Tomorrow', value: addDays(today, 1) },
    { label: 'In 2 days', value: addDays(today, 2) },
    { label: 'Next week', value: addDays(today, 7) },
  ];

  return (
    <FormScreen>
      <ScreenHeader title={existing ? 'Edit task' : 'New task'} modal />
      <Field label="Task" value={title} onChangeText={setTitle} placeholder="e.g. Buy notebook, call home, print lab record" autoFocus={!existing} maxLength={100} />
      <SectionTitle>Day</SectionTitle>
      <ChipRow>
        {dayChips.map((d) => (
          <Chip key={d.label} label={d.label} selected={date === d.value} onPress={() => setDate(d.value)} />
        ))}
      </ChipRow>
      <DateField label="Date" value={date} onChange={setDate} />
      <TimeField label="Time (optional)" value={time} onChange={setTime} optional placeholder="No time: goes in the day’s to-do list" hint="With a time it shows on the dial; without one it goes in the to-do list." />
      {time.trim() ? (
        <>
          <SectionTitle>How long</SectionTitle>
          <ChipRow>
            {TASK_DURATIONS.map((m) => (
              <Chip key={m} label={m < 60 ? `${m} min` : `${m / 60} h`} selected={minutes === m} onPress={() => setMinutes(m)} />
            ))}
          </ChipRow>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ color: theme.text, fontSize: 16, flex: 1 }}>Remind me at this time</Text>
            <Switch value={remind} onValueChange={setRemind} accessibilityLabel="Remind me" trackColor={{ true: theme.primary }} />
          </View>
        </>
      ) : null}
      <Field label="Notes" value={notes} onChangeText={setNotes} multiline />
      <ErrorText>{error}</ErrorText>
      <Button title="Save" onPress={save} />
      {existing ? (
        <>
          <Button
            title={existing.done ? 'Mark not done' : 'Mark done'}
            variant="plain"
            onPress={() => {
              apply((s) => setTodoDone(s, existing.id, !existing.done, Date.now()));
              router.back();
            }}
          />
          <Button
            title="Delete task"
            variant="danger"
            onPress={() =>
              confirmDestructive('Delete task?', existing.title, 'Delete', () => {
                apply((s) => removeTodo(s, existing.id));
                router.back();
              })
            }
          />
        </>
      ) : null}
    </FormScreen>
  );
}
