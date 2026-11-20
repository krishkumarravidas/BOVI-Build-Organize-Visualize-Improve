import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';

import { Button } from '@/components/Button';
import { NotFound, styles, useRouteProject } from '@/components/gamedev/common';
import { Chip, ChipRow, EmptyText, ErrorText, ScreenHeader, confirmDestructive } from '@/components/ui';
import { newId } from '@/hooks/useCollege';
import { useTheme } from '@/hooks/useTheme';
import { REF_TAGS, forProject, removeItem, upsertItem, type RefImage, type RefTag } from '@/lib/gamedev';
import { deleteStoredImage, pickAndStoreImage } from '@/lib/images';

const TAG_LABEL: Record<RefTag, string> = { mood: 'Mood', lighting: 'Lighting', monster: 'Monster', level: 'Level', ui: 'UI', other: 'Other' };

/** Reference images per project (mood, lighting, monsters…), stored inside the app. */
export default function RefsScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const { project, p } = useRouteProject();
  const [tag, setTag] = useState<RefTag | 'all'>('all');
  const [addTag, setAddTag] = useState<RefTag>('mood');
  const [open, setOpen] = useState<RefImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!project) return <NotFound />;
  const refs = forProject(p.state.refs, project.id).sort((a, b) => b.createdAt - a.createdAt);
  const shown = refs.filter((r) => tag === 'all' || r.tag === tag);
  const cols = width > 600 ? 4 : 3;
  const size = (Math.min(width, 900) - 32 - (cols - 1) * 6) / cols;

  const add = async () => {
    setError(null);
    try {
      const id = newId();
      const uri = await pickAndStoreImage('refs', id);
      if (uri) p.apply((s) => upsertItem(s, 'refs', { id, projectId: project.id, uri, tag: addTag, createdAt: Date.now() }));
    } catch {
      setError('Couldn’t open your photos.');
    }
  };

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.screen}>
      <ScreenHeader title={`${project.name}: references`} />
      <Text style={{ color: theme.text, fontWeight: '700' }}>New image goes under</Text>
      <ChipRow>
        {REF_TAGS.map((t) => (
          <Chip key={t} label={TAG_LABEL[t]} selected={addTag === t} onPress={() => setAddTag(t)} />
        ))}
      </ChipRow>
      <Button title="Add reference image" onPress={add} />
      <ErrorText>{error}</ErrorText>
      <ChipRow>
        <Chip label={`All (${refs.length})`} selected={tag === 'all'} onPress={() => setTag('all')} />
        {REF_TAGS.filter((t) => refs.some((r) => r.tag === t)).map((t) => (
          <Chip key={t} label={`${TAG_LABEL[t]} (${refs.filter((r) => r.tag === t).length})`} selected={tag === t} onPress={() => setTag(t)} />
        ))}
      </ChipRow>
      {shown.length === 0 ? <EmptyText>No references yet. Screenshots from films, games and photos that capture the feel you want.</EmptyText> : null}
      <View style={local.grid}>
        {shown.map((r) => (
          <Pressable key={r.id} onPress={() => setOpen(r)} accessibilityRole="imagebutton" accessibilityLabel={r.caption || `${TAG_LABEL[r.tag]} reference`}>
            <Image source={{ uri: r.uri }} style={{ width: size, height: size, borderRadius: 8, backgroundColor: theme.surface }} />
          </Pressable>
        ))}
      </View>
      <RefViewer
        image={open}
        onClose={() => setOpen(null)}
        onSave={(r) => {
          p.apply((s) => upsertItem(s, 'refs', r));
          setOpen(null);
        }}
        onDelete={(r) =>
          confirmDestructive('Delete image?', r.caption || 'This reference will be removed.', 'Delete', () => {
            deleteStoredImage(r.uri);
            p.apply((s) => removeItem(s, 'refs', r.id));
            setOpen(null);
          })
        }
      />
    </ScrollView>
  );
}

function RefViewer({ image, onClose, onSave, onDelete }: { image: RefImage | null; onClose: () => void; onSave: (r: RefImage) => void; onDelete: (r: RefImage) => void }) {
  const theme = useTheme();
  const [caption, setCaption] = useState('');
  const [tag, setTag] = useState<RefTag>('mood');
  const [shownId, setShownId] = useState<string | null>(null);
  // Reset the form when a different image opens.
  if (image && image.id !== shownId) {
    setShownId(image.id);
    setCaption(image.caption ?? '');
    setTag(image.tag);
  }
  return (
    <Modal visible={!!image} transparent animationType="fade" onRequestClose={onClose}>
      <View style={local.backdrop}>
        {image ? (
          <View style={[local.sheet, { backgroundColor: theme.surface }]}>
            <Image source={{ uri: image.uri }} style={{ width: '100%', aspectRatio: 1, borderRadius: 10 }} resizeMode="contain" accessibilityLabel={caption || 'Reference image'} />
            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder="Caption (what to take from it)"
              placeholderTextColor={theme.muted}
              accessibilityLabel="Caption"
              style={[local.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
            />
            <ChipRow>
              {REF_TAGS.map((t) => (
                <Chip key={t} label={TAG_LABEL[t]} selected={tag === t} onPress={() => setTag(t)} />
              ))}
            </ChipRow>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button title="Delete" variant="danger" onPress={() => onDelete(image)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title="Close" variant="plain" onPress={onClose} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title="Save" onPress={() => onSave({ ...image, caption: caption.trim() || undefined, tag })} />
              </View>
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const local = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 16 },
  sheet: { borderRadius: 16, padding: 12, gap: 10, maxWidth: 640, width: '100%', alignSelf: 'center' },
  input: { borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 15 },
});
