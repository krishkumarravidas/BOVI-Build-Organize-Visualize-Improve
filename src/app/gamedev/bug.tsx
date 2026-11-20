import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, Platform, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip, ChipRow, ErrorText, Field, FormScreen, ScreenHeader, SectionTitle, confirmDestructive } from '@/components/ui';
import { newId } from '@/hooks/useCollege';
import { useProjects } from '@/hooks/useProjects';
import { useTheme } from '@/hooks/useTheme';
import { SEVERITY_LABEL, SEVERITY_ORDER, removeItem, setBugStatus, upsertItem, type Bug, type BugSeverity } from '@/lib/gamedev';
import { deleteStoredImage, pickAndStoreImage } from '@/lib/images';

/** Report or edit one bug: title, severity, steps to reproduce, screenshot. */
export default function BugScreen() {
  const { id: projectId, bug: bugId } = useLocalSearchParams<{ id: string; bug: string }>();
  const theme = useTheme();
  const p = useProjects();
  const existing = bugId === 'new' ? undefined : p.state.bugs?.find((b) => b.id === bugId);
  const [draftId] = useState(() => existing?.id ?? newId());
  const [title, setTitle] = useState(existing?.title ?? '');
  const [severity, setSeverity] = useState<BugSeverity>(existing?.severity ?? 'medium');
  const [steps, setSteps] = useState(existing?.steps ?? '');
  const [image, setImage] = useState<string | undefined>(existing?.image);
  const [error, setError] = useState<string | null>(null);

  if (bugId !== 'new' && !existing) {
    return (
      <FormScreen>
        <ScreenHeader title="Bug" modal />
        <Text style={{ color: theme.muted }}>This bug no longer exists.</Text>
      </FormScreen>
    );
  }

  const save = () => {
    if (!title.trim()) return setError('Describe the bug in a few words');
    const bug: Bug = {
      id: draftId,
      projectId: existing?.projectId ?? projectId,
      title: title.trim(),
      severity,
      steps: steps.trim() || undefined,
      status: existing?.status ?? 'open',
      createdAt: existing?.createdAt ?? Date.now(),
      ...(existing?.fixedAt ? { fixedAt: existing.fixedAt } : {}),
      ...(image ? { image } : {}),
    };
    if (existing?.image && existing.image !== image) deleteStoredImage(existing.image);
    p.apply((s) => upsertItem(s, 'bugs', bug));
    router.back();
  };

  const attach = async () => {
    try {
      const uri = await pickAndStoreImage('bugs', `${draftId}-${Date.now().toString(36)}`);
      if (uri) {
        if (image && image !== existing?.image) deleteStoredImage(image);
        setImage(uri);
      }
    } catch {
      setError('Couldn’t open your photos.');
    }
  };

  return (
    <FormScreen>
      <ScreenHeader title={existing ? 'Edit bug' : 'Report a bug'} modal />
      <Field label="What’s wrong?" value={title} onChangeText={setTitle} placeholder="e.g. Player falls through the stairs" autoFocus={!existing} maxLength={100} />
      <SectionTitle>Severity</SectionTitle>
      <ChipRow>
        {SEVERITY_ORDER.map((s) => (
          <Chip key={s} label={SEVERITY_LABEL[s]} selected={severity === s} onPress={() => setSeverity(s)} />
        ))}
      </ChipRow>
      <Field label="Steps to reproduce" value={steps} onChangeText={setSteps} placeholder={'1. Load level 1\n2. Sprint down the stairs\n3. …'} multiline />
      <SectionTitle>Screenshot</SectionTitle>
      {image ? <Image source={{ uri: image }} style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 12, backgroundColor: theme.surface }} resizeMode="contain" accessibilityLabel="Bug screenshot" /> : null}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Button title={image ? 'Change screenshot' : 'Attach screenshot'} variant="plain" onPress={attach} />
        </View>
        {image ? (
          <View style={{ flex: 1 }}>
            <Button title="Remove" variant="danger" onPress={() => setImage(undefined)} />
          </View>
        ) : null}
      </View>
      {Platform.OS !== 'web' ? <Text style={{ color: theme.muted, fontSize: 13 }}>Screenshots are kept inside BOVI. Backups include the bug text, not the images.</Text> : null}
      <ErrorText>{error}</ErrorText>
      <Button title="Save" onPress={save} />
      {existing ? (
        <>
          <Button
            title={existing.status === 'open' ? 'Mark fixed' : 'Reopen'}
            variant="plain"
            onPress={() => {
              p.apply((s) => setBugStatus(s, existing.id, existing.status === 'open' ? 'fixed' : 'open', Date.now()));
              router.back();
            }}
          />
          <Button
            title="Delete bug"
            variant="danger"
            onPress={() =>
              confirmDestructive('Delete bug?', existing.title, 'Delete', () => {
                deleteStoredImage(existing.image);
                p.apply((s) => removeItem(s, 'bugs', existing.id));
                router.back();
              })
            }
          />
        </>
      ) : null}
    </FormScreen>
  );
}
