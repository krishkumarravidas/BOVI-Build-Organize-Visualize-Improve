import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { openLink } from '@/components/LinkList';
import { AddPanel, styles } from '@/components/gamedev/common';
import { Chip, ChipRow, EmptyText, ErrorText, Field, ScreenHeader, SectionTitle, confirmDestructive } from '@/components/ui';
import { newId } from '@/hooks/useCollege';
import { useProjects } from '@/hooks/useProjects';
import { useTheme } from '@/hooks/useTheme';
import { toDateKey } from '@/lib/dates';
import { removeItem, upsertItem, type LearningItem } from '@/lib/gamedev';
import { linkInfo, normalizeUrl } from '@/lib/links';

const STATUS: { key: LearningItem['status']; label: string }[] = [
  { key: 'doing', label: 'Learning now' },
  { key: 'todo', label: 'Up next' },
  { key: 'done', label: 'Done' },
];

/** Tutorials/courses to learn, linked to the project that needs them — from "watch later" to "applied". */
export default function LearningScreen() {
  const theme = useTheme();
  const p = useProjects();
  const items = p.state.learning ?? [];
  const projectName = (id?: string) => p.projects.find((x) => x.id === id)?.name;
  const save = (item: LearningItem) => p.apply((s) => upsertItem(s, 'learning', item));

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <ScreenHeader title="Learning queue" />
      <Text style={{ color: theme.muted }}>Courses and tutorials you need for your games. When you finish one, note where you used it.</Text>
      <AddPanel label="Add to queue">{(close) => <LearningForm onSave={(i) => { save(i); close(); }} onCancel={close} />}</AddPanel>
      {STATUS.map((st) => {
        const list = items.filter((i) => i.status === st.key);
        if (!list.length && st.key === 'done') return null;
        return (
          <View key={st.key} style={{ gap: 8 }}>
            <SectionTitle>{`${st.label} · ${list.length}`}</SectionTitle>
            {!list.length ? <EmptyText>Nothing here.</EmptyText> : null}
            {list.map((i) => (
              <LearningCard key={i.id} item={i} projectName={projectName(i.projectId)} onChange={save} onDelete={() => confirmDestructive('Remove?', i.title, 'Remove', () => p.apply((s) => removeItem(s, 'learning', i.id)))} />
            ))}
          </View>
        );
      })}
    </ScrollView>
  );
}

function LearningCard({ item, projectName, onChange, onDelete }: { item: LearningItem; projectName?: string; onChange: (i: LearningItem) => void; onDelete: () => void }) {
  const theme = useTheme();
  const [applied, setApplied] = useState(item.applied ?? '');
  return (
    <View style={[local.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16 }}>{item.title}</Text>
      <Text style={{ color: theme.muted, fontSize: 13 }}>
        {[projectName ? `for ${projectName}` : null, item.url ? linkInfo(item.url).label : null].filter(Boolean).join(' · ') || 'General'}
      </Text>
      <ChipRow>
        {STATUS.map((st) => (
          <Chip
            key={st.key}
            label={st.label}
            selected={item.status === st.key}
            onPress={() => onChange(st.key === 'done' ? { ...item, status: 'done', doneAt: item.doneAt ?? Date.now() } : { ...item, status: st.key, doneAt: undefined })}
          />
        ))}
      </ChipRow>
      {item.status === 'done' ? (
        <TextInput
          value={applied}
          onChangeText={setApplied}
          onBlur={() => applied.trim() !== (item.applied ?? '') && onChange({ ...item, applied: applied.trim() || undefined })}
          placeholder="Applied where? e.g. My game: enemy hearing system"
          placeholderTextColor={theme.muted}
          accessibilityLabel="Where you applied it"
          style={[local.input, { color: theme.text, borderColor: theme.border }]}
        />
      ) : null}
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {item.url ? <Button title="Open" variant="plain" onPress={() => openLink(item.url!)} /> : null}
        <Button title="Remove" variant="danger" onPress={onDelete} />
      </View>
    </View>
  );
}

function LearningForm({ onSave, onCancel }: { onSave: (i: LearningItem) => void; onCancel: () => void }) {
  const p = useProjects();
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [projectId, setProjectId] = useState<string | undefined>(p.projects.find((x) => x.status === 'active')?.id);
  const [error, setError] = useState<string | null>(null);
  const save = () => {
    if (!title.trim()) return setError('What is it? e.g. UE5 Behavior Trees course');
    const link = url.trim() ? normalizeUrl(url) : undefined;
    if (url.trim() && !link) return setError('The link doesn’t look like a web link');
    onSave({ id: newId(), title: title.trim(), status: 'todo', createdAt: toDateKey(new Date()), ...(link ? { url: link } : {}), ...(projectId ? { projectId } : {}) });
  };
  return (
    <>
      <Field label="Course / tutorial" value={title} onChangeText={setTitle} placeholder="e.g. UE5 AI Perception deep dive" autoFocus maxLength={100} />
      <Field label="Link (optional)" value={url} onChangeText={setUrl} placeholder="YouTube, Udemy, docs…" autoCapitalize="none" keyboardType="url" />
      <ChipRow>
        <Chip label="General" selected={!projectId} onPress={() => setProjectId(undefined)} />
        {p.projects
          .filter((x) => x.status !== 'done' && x.status !== 'parked')
          .map((x) => (
            <Chip key={x.id} label={x.name} selected={projectId === x.id} onPress={() => setProjectId(x.id)} />
          ))}
      </ChipRow>
      <ErrorText>{error}</ErrorText>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Button title="Cancel" variant="plain" onPress={onCancel} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Add" onPress={save} />
        </View>
      </View>
    </>
  );
}

const local = StyleSheet.create({
  card: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 8 },
  input: { borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 15 },
});
