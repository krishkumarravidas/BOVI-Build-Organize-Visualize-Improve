import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip, ChipRow, EmptyText, SectionTitle, shortDate } from '@/components/ui';
import { useProjects } from '@/hooks/useProjects';
import { useTheme } from '@/hooks/useTheme';
import { addDays, toDateKey } from '@/lib/dates';
import { STATUS_ORDER, devlogMarkdown } from '@/lib/projects';

/** One feed of devlog entries across projects, with quick entry for the chosen project. */
export default function DevlogTab() {
  const theme = useTheme();
  const p = useProjects();
  const choices = [...p.projects]
    .filter((x) => x.status !== 'done' && x.status !== 'parked')
    .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));
  const [projectId, setProjectId] = useState<string | undefined>(choices[0]?.id);
  const [text, setText] = useState('');
  const selected = p.projects.find((x) => x.id === projectId);

  const feed = p.projects
    .flatMap((proj) => proj.log.map((e) => ({ ...e, project: proj })))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
    .slice(0, 60);

  const add = () => {
    if (!projectId || !text.trim()) return;
    p.addLog(projectId, text);
    setText('');
  };
  const share = () => {
    if (!selected) return;
    const today = toDateKey(new Date());
    Share.share({ message: devlogMarkdown(selected, addDays(today, -6), today), title: `${selected.name} devlog` }).catch(() => {});
  };

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <ChipRow>
        {choices.slice(0, 8).map((x) => (
          <Chip key={x.id} label={x.name.length > 22 ? `${x.name.slice(0, 21)}…` : x.name} selected={projectId === x.id} onPress={() => setProjectId(x.id)} />
        ))}
      </ChipRow>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={selected ? `What did you do on ${selected.name} today?` : 'Pick a project'}
        placeholderTextColor={theme.muted}
        accessibilityLabel="Devlog entry"
        multiline
        style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
      />
      <View style={styles.actions}>
        <View style={{ flex: 1 }}>
          <Button title="Add entry" onPress={add} disabled={!projectId || !text.trim()} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Share week" variant="plain" onPress={share} disabled={!selected} />
        </View>
      </View>

      <SectionTitle>Recent entries</SectionTitle>
      {feed.length === 0 ? <EmptyText>No entries yet. A line a day adds up to a great devlog.</EmptyText> : null}
      {feed.map((e) => (
        <View key={e.id} style={[styles.entry, { borderColor: theme.primary }]}>
          <View style={styles.entryHead}>
            <Text style={{ color: theme.muted, fontWeight: '700', flex: 1 }} numberOfLines={1}>
              {shortDate(e.date)} · {e.project.name}
            </Text>
            <Pressable onPress={() => p.removeLog(e.project.id, e.id)} accessibilityRole="button" accessibilityLabel={`Delete entry from ${shortDate(e.date)}`} hitSlop={8}>
              <Ionicons name="close" size={20} color={theme.muted} />
            </Pressable>
          </View>
          <Text style={{ color: theme.text, fontSize: 15 }}>{e.text}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingTop: 8, gap: 10, paddingBottom: 32 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, minHeight: 90, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: 10 },
  entry: { borderLeftWidth: 3, paddingLeft: 10, gap: 2 },
  entryHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
