import { Stack, router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { BackHandler, Image, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip, ChipRow, ErrorText, Field, KeyboardScroll, SectionTitle } from '@/components/ui';
import { newId, useCollege } from '@/hooks/useCollege';
import { useProjects } from '@/hooks/useProjects';
import { useTheme } from '@/hooks/useTheme';
import { setSubjectLinks } from '@/lib/college';
import { toDateKey } from '@/lib/dates';
import { REF_TAGS, upsertItem, type RefTag } from '@/lib/gamedev';
import { deleteStoredImage } from '@/lib/images';
import { addLink, displayUrl, linkInfo } from '@/lib/links';
import { setProjectLinks } from '@/lib/projects';
import { TARGET_LABEL, availableTargets, parseShare, peekPendingShare, setPendingShare, suggestTarget, type ShareTarget } from '@/lib/share';

/** "Save to BOVI": where a shared link, text or image should go. */
export default function ShareScreen() {
  const theme = useTheme();
  const c = useCollege();
  const p = useProjects();
  const params = useLocalSearchParams<{ text?: string; subject?: string }>();
  // From the share sheet (native), or a bovi://share?text=… link.
  const [share] = useState(() => peekPendingShare() ?? (params.text ? parseShare({ text: params.text, subject: params.subject }) : null));
  const [target, setTarget] = useState<ShareTarget>(() => (share ? suggestTarget(share) : 'idea'));
  const [title, setTitle] = useState(share?.title ?? '');
  const [ideaText, setIdeaText] = useState(() => (share ? [share.title, share.url].filter(Boolean).join('\n') : ''));
  // Defaults follow the data as it loads, until you pick something ('none' = explicitly no project).
  const [pickedSubject, setSubjectId] = useState<string | null>(null);
  const subjectId = pickedSubject ?? c.college.subjects[0]?.id;
  const liveProjects = p.projects.filter((x) => x.status !== 'done' && x.status !== 'parked');
  const [pickedProject, setPickedProject] = useState<string | null>(null);
  const projectId = pickedProject === 'none' ? undefined : (pickedProject ?? liveProjects.find((x) => x.status === 'active')?.id ?? liveProjects[0]?.id);
  const setProjectId = (id: string | undefined) => setPickedProject(id ?? 'none');
  const [tag, setTag] = useState<RefTag>('mood');
  const [saved, setSaved] = useState<{ label: string; href: Href } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const leave = () => {
    setPendingShare(null);
    if (router.canGoBack()) router.back();
    else if (Platform.OS === 'android') BackHandler.exitApp();
    else router.replace('/');
  };

  if (!share) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ headerShown: true, title: 'Save to BOVI' }} />
        <Text style={{ color: theme.muted }}>Nothing to save. Share a link, text or image to BOVI from another app.</Text>
        <Button title="Close" variant="plain" onPress={leave} />
      </View>
    );
  }

  const cancel = () => {
    share.images.forEach(deleteStoredImage);
    leave();
  };

  const save = () => {
    setError(null);
    const t = title.trim() || (share.url ? displayUrl(share.url) : 'Shared');
    switch (target) {
      case 'subject': {
        const subject = c.college.subjects.find((s) => s.id === subjectId);
        if (!subject || !share.url) return setError('Pick a subject');
        c.apply((s) => setSubjectLinks(s, subject.id, addLink(subject.links, { id: newId(), title: t, url: share.url! })));
        return setSaved({ label: `${subject.short} links`, href: { pathname: '/college/subject/[id]', params: { id: subject.id } } });
      }
      case 'project': {
        const project = p.projects.find((x) => x.id === projectId);
        if (!project || !share.url) return setError('Pick a project');
        p.apply((s) => setProjectLinks(s, project.id, addLink(project.links, { id: newId(), title: t, url: share.url! })));
        return setSaved({ label: `${project.name} links`, href: { pathname: '/project/[id]', params: { id: project.id } } });
      }
      case 'learning':
        p.apply((s) => upsertItem(s, 'learning', { id: newId(), title: t, status: 'todo', createdAt: toDateKey(new Date()), ...(share.url ? { url: share.url } : {}), ...(projectId ? { projectId } : {}) }));
        return setSaved({ label: 'your learning queue', href: '/gamedev/learning' });
      case 'idea':
        if (!ideaText.trim()) return setError('Write something');
        p.addIdea(ideaText);
        return setSaved({ label: 'your ideas inbox', href: '/ideas' });
      case 'ref': {
        if (!projectId) return setError('Pick a project');
        const now = Date.now();
        p.apply((s) => share.images.reduce((acc, uri, i) => upsertItem(acc, 'refs', { id: newId() + i, projectId, uri, tag, createdAt: now + i, ...(title.trim() ? { caption: title.trim() } : {}) }), s));
        return setSaved({ label: `the reference board`, href: { pathname: '/gamedev/refs', params: { id: projectId } } as unknown as Href });
      }
      case 'bug': {
        if (!projectId) return setError('Pick a project');
        if (!title.trim()) return setError('Describe the bug in a few words');
        const [image, ...rest] = share.images;
        rest.forEach(deleteStoredImage);
        p.apply((s) => upsertItem(s, 'bugs', { id: newId(), projectId, title: title.trim(), severity: 'medium', status: 'open', createdAt: Date.now(), ...(image ? { image } : {}) }));
        return setSaved({ label: 'bugs', href: { pathname: '/gamedev/bugs', params: { id: projectId } } as unknown as Href });
      }
    }
  };

  if (saved) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ headerShown: true, title: 'Saved' }} />
        <Text style={[styles.big, { color: theme.accent }]}>Saved to {saved.label}</Text>
        <Button title="Done" onPress={leave} />
        <Button
          title="Open in BOVI"
          variant="plain"
          onPress={() => {
            setPendingShare(null);
            router.replace(saved.href);
          }}
        />
      </View>
    );
  }

  const info = share.url ? linkInfo(share.url) : null;
  const needsProject = target === 'project' || target === 'ref' || target === 'bug' || target === 'learning';
  return (
    <KeyboardScroll style={{ backgroundColor: theme.background }} contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ headerShown: true, title: 'Save to BOVI', headerStyle: { backgroundColor: theme.background }, headerTitleStyle: { color: theme.text }, headerTintColor: theme.primary }} />

      {share.images.length ? (
        <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
          {share.images.map((uri) => (
            <Image key={uri} source={{ uri }} style={styles.thumb} accessibilityLabel="Shared image" />
          ))}
        </ScrollView>
      ) : null}
      {share.url ? (
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={{ color: theme.muted, fontSize: 12 }}>{info?.label}</Text>
          <Text style={{ color: theme.text }} numberOfLines={2}>
            {displayUrl(share.url)}
          </Text>
        </View>
      ) : null}

      <SectionTitle>Save to</SectionTitle>
      <ChipRow>
        {availableTargets(share).map((t) => (
          <Chip key={t} label={TARGET_LABEL[t]} selected={target === t} onPress={() => setTarget(t)} />
        ))}
      </ChipRow>

      {target === 'idea' ? (
        <Field label="Idea" value={ideaText} onChangeText={setIdeaText} multiline />
      ) : (
        <Field
          label={target === 'bug' ? 'What’s wrong?' : target === 'ref' ? 'Caption (optional)' : 'Title'}
          value={title}
          onChangeText={setTitle}
          placeholder={target === 'bug' ? 'e.g. Lighting flickers in the first room' : undefined}
          maxLength={100}
        />
      )}

      {target === 'subject' ? (
        c.college.subjects.length ? (
          <ChipRow>
            {c.college.subjects.map((s) => (
              <Chip key={s.id} label={s.short} color={s.color} selected={subjectId === s.id} onPress={() => setSubjectId(s.id)} />
            ))}
          </ChipRow>
        ) : (
          <Text style={{ color: theme.muted }}>No subjects yet.</Text>
        )
      ) : null}

      {needsProject ? (
        <ChipRow>
          {target === 'learning' ? <Chip label="General" selected={!projectId} onPress={() => setProjectId(undefined)} /> : null}
          {liveProjects.map((x) => (
            <Chip key={x.id} label={x.name.length > 24 ? `${x.name.slice(0, 23)}…` : x.name} selected={projectId === x.id} onPress={() => setProjectId(x.id)} />
          ))}
        </ChipRow>
      ) : null}

      {target === 'ref' ? (
        <ChipRow>
          {REF_TAGS.map((t) => (
            <Chip key={t} label={t[0].toUpperCase() + t.slice(1)} selected={tag === t} onPress={() => setTag(t)} />
          ))}
        </ChipRow>
      ) : null}

      <ErrorText>{error}</ErrorText>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Button title="Cancel" variant="plain" onPress={cancel} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Save" onPress={save} />
        </View>
      </View>
    </KeyboardScroll>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, padding: 16, gap: 12, paddingBottom: 40 },
  card: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 4 },
  thumb: { width: 110, height: 110, borderRadius: 10 },
  big: { fontSize: 20, fontWeight: '800' },
});
