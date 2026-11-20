import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { DayPicker } from '@/components/DayPicker';
import { useHabits } from '@/hooks/useHabits';
import { useTheme } from '@/hooks/useTheme';
import { ALL_DAYS, type Weekday } from '@/lib/types';
import { isValidReminderTime } from '@/lib/stats';

export default function HabitFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { state, add, update, archive } = useHabits();
  const existing = id === 'new' ? undefined : state.habits.find((h) => h.id === id);

  const [name, setName] = useState(existing?.name ?? '');
  const [days, setDays] = useState<Weekday[]>(existing?.days ?? [...ALL_DAYS]);
  const [reminder, setReminder] = useState(existing?.reminderTime ?? '');
  const [submitted, setSubmitted] = useState(false);

  const nameError = submitted && !name.trim() ? 'Enter a name' : undefined;
  const daysError = submitted && days.length === 0 ? 'Pick at least one day' : undefined;
  const reminderError = !isValidReminderTime(reminder) ? 'Use 24h format, e.g. 08:30' : undefined;

  const save = () => {
    setSubmitted(true);
    if (!name.trim() || days.length === 0 || reminderError) return;
    const reminderTime = reminder || undefined;
    if (existing) update(existing.id, { name: name.trim(), days, reminderTime });
    else add({ name, days, reminderTime });
    router.back();
  };

  const confirmArchive = () => {
    if (!existing) return;
    const run = () => {
      archive(existing.id);
      router.back();
    };
    if (Platform.OS === 'web') return run();
    Alert.alert('Archive habit?', 'It will be hidden but your history is kept.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Archive', style: 'destructive', onPress: run },
    ]);
  };

  const inputStyle = [styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: existing ? 'Edit habit' : 'New habit',
          presentation: 'modal',
          headerStyle: { backgroundColor: theme.background },
          headerTitleStyle: { color: theme.text },
          headerTintColor: theme.primary,
        }}
      />
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {id !== 'new' && !existing ? (
          <Text style={{ color: theme.muted }}>This habit no longer exists.</Text>
        ) : (
          <>
            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.text }]}>Name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Read for 20 minutes"
                placeholderTextColor={theme.muted}
                style={inputStyle}
                maxLength={60}
                returnKeyType="done"
              />
              {nameError ? <Text style={{ color: theme.danger }}>{nameError}</Text> : null}
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.text }]}>Repeat on</Text>
              <DayPicker value={days} onChange={setDays} />
              {daysError ? <Text style={{ color: theme.danger }}>{daysError}</Text> : null}
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.text }]}>Reminder (optional)</Text>
              <TextInput
                value={reminder}
                onChangeText={setReminder}
                placeholder="HH:mm"
                placeholderTextColor={theme.muted}
                style={inputStyle}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
              {reminderError ? <Text style={{ color: theme.danger }}>{reminderError}</Text> : null}
            </View>

            <Button title="Save" onPress={save} />
            {existing ? <Button title="Archive habit" variant="danger" onPress={confirmArchive} /> : null}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 20 },
  field: { gap: 8 },
  label: { fontSize: 15, fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
});
