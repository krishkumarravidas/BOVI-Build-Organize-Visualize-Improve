import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { DayPicker } from '@/components/DayPicker';
import { useHabits } from '@/hooks/useHabits';
import { useTheme } from '@/hooks/useTheme';
import { isOvernight, validateBlock } from '@/lib/schedule';
import type { Weekday } from '@/lib/types';
import { KeyboardScroll, TimeField } from '@/components/ui';

export default function BlockFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { state, addBlock, updateBlock, deleteBlock } = useHabits();
  const existing = id === 'new' ? undefined : state.blocks.find((b) => b.id === id);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [days, setDays] = useState<Weekday[]>(existing?.days ?? [1, 2, 3, 4, 5]);
  const [start, setStart] = useState(existing?.start ?? '09:00');
  const [end, setEnd] = useState(existing?.end ?? '10:00');
  const [remind, setRemind] = useState(existing?.remind ?? false);
  const [submitted, setSubmitted] = useState(false);

  const input = { title, days, start, end, remind };
  const error = submitted ? validateBlock(input) : null;
  const overnight = !validateBlock({ ...input, title: 'x', days: [1] }) && isOvernight(input);

  const save = () => {
    setSubmitted(true);
    if (validateBlock(input)) return;
    if (existing) updateBlock(existing.id, input);
    else addBlock(input);
    router.back();
  };

  const confirmDelete = () => {
    if (!existing) return;
    const run = () => {
      deleteBlock(existing.id);
      router.back();
    };
    if (Platform.OS === 'web') return run();
    Alert.alert('Delete block?', `"${existing.title}" will be removed from your schedule.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: run },
    ]);
  };

  const inputStyle = [styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }];

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: existing ? 'Edit block' : 'New block',
          presentation: 'modal',
          headerStyle: { backgroundColor: theme.background },
          headerTitleStyle: { color: theme.text },
          headerTintColor: theme.primary,
        }}
      />
      <KeyboardScroll
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {id !== 'new' && !existing ? (
          <Text style={{ color: theme.muted }}>This block no longer exists.</Text>
        ) : (
          <>
            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.text }]}>Title</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Physics class"
                placeholderTextColor={theme.muted}
                style={inputStyle}
                maxLength={60}
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.text }]}>Days</Text>
              <DayPicker value={days} onChange={setDays} />
            </View>

            <View style={styles.timeRow}>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={[styles.label, { color: theme.text }]}>Start</Text>
                <TimeField value={start} onChange={setStart} accessibilityLabel="Start time" />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={[styles.label, { color: theme.text }]}>End</Text>
                <TimeField value={end} onChange={setEnd} accessibilityLabel="End time" fallback={start || '10:00'} />
              </View>
            </View>
            {overnight ? <Text style={{ color: theme.muted }}>Ends the next day.</Text> : null}

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: theme.text }]}>Remind me when it starts</Text>
                <Text style={{ color: theme.muted }}>Uses the Habit reminders setting.</Text>
              </View>
              <Switch
                value={remind}
                onValueChange={setRemind}
                accessibilityLabel="Remind me when it starts"
                trackColor={{ true: theme.primary }}
              />
            </View>

            {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}
            <Button title="Save" onPress={save} />
            {existing ? <Button title="Delete block" variant="danger" onPress={confirmDelete} /> : null}
          </>
        )}
      </KeyboardScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 20 },
  field: { gap: 8 },
  label: { fontSize: 15, fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  timeRow: { flexDirection: 'row', gap: 12 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
