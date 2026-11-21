import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { EmptyText, shortDate } from '@/components/ui';
import { useProjects } from '@/hooks/useProjects';
import { useTheme } from '@/hooks/useTheme';

/** Capture ideas without starting them; promote the good ones to Concept projects. */
export default function IdeasTab() {
  const theme = useTheme();
  const { state, addIdea, removeIdea, promoteIdea } = useProjects();
  const [idea, setIdea] = useState('');
  const submit = () => {
    if (!idea.trim()) return;
    addIdea(idea);
    setIdea('');
  };

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <TextInput
        value={idea}
        onChangeText={setIdea}
        onSubmitEditing={submit}
        placeholder="Capture an idea without starting it"
        placeholderTextColor={theme.muted}
        accessibilityLabel="New idea"
        returnKeyType="done"
        multiline
        blurOnSubmit
        style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
      />
      <Button title="Save idea" onPress={submit} disabled={!idea.trim()} />
      <Text style={{ color: theme.muted }}>One active project at a time. Park the rest here.</Text>
      {state.ideas.length === 0 ? <EmptyText>No ideas yet.</EmptyText> : null}
      {state.ideas.map((i) => (
        <View key={i.id} style={[styles.idea, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontSize: 16 }}>{i.text}</Text>
            <Text style={{ color: theme.muted, fontSize: 12 }}>{shortDate(i.createdAt)}</Text>
          </View>
          <Pressable
            onPress={() => router.push({ pathname: '/project/[id]', params: { id: promoteIdea(i.id) } })}
            accessibilityRole="button"
            accessibilityLabel={`Make project from idea ${i.text}`}
            hitSlop={6}
          >
            <Text style={{ color: theme.primary, fontWeight: '700' }}>Make project</Text>
          </Pressable>
          <Pressable onPress={() => removeIdea(i.id)} accessibilityRole="button" accessibilityLabel={`Delete idea ${i.text}`} hitSlop={8}>
            <Ionicons name="close" size={20} color={theme.muted} />
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingTop: 8, gap: 10, paddingBottom: 32 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, minHeight: 64, textAlignVertical: 'top' },
  idea: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
});
