import { useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { openLink } from '@/components/LinkList';
import { AddPanel, NotFound, styles, useRouteProject } from '@/components/gamedev/common';
import { DateField, EmptyText, ErrorText, Field, KeyboardScroll, ScreenHeader, SectionTitle, confirmDestructive, shortDate } from '@/components/ui';
import { newId } from '@/hooks/useCollege';
import { useTheme } from '@/hooks/useTheme';
import { fromDateKey, isValidDateKey, toDateKey } from '@/lib/dates';
import { changelog, forProject, lastBuild, nextVersion, removeItem, upsertItem, type Build } from '@/lib/gamedev';
import { normalizeUrl } from '@/lib/links';
import type { ProjectsState } from '@/lib/projects';

/** Builds with versions and changelogs written from what you finished since the last one. */
export default function BuildsScreen() {
  const theme = useTheme();
  const { project, p } = useRouteProject();
  if (!project) return <NotFound />;
  const builds = forProject(p.state.builds, project.id).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const last = lastBuild(p.state, project.id);

  return (
    <KeyboardScroll style={{ backgroundColor: theme.background }} contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <ScreenHeader title={`${project.name}: builds`} />
      <AddPanel label="New build">
        {(close) => (
          <BuildForm
            state={p.state}
            projectId={project.id}
            last={last}
            onSave={(b) => {
              p.apply((s) => upsertItem(s, 'builds', b));
              close();
            }}
            onCancel={close}
          />
        )}
      </AddPanel>
      <SectionTitle>{`${builds.length} build${builds.length === 1 ? '' : 's'}`}</SectionTitle>
      {builds.length === 0 ? <EmptyText>No builds yet. Log each one you package so you can tell testers exactly what changed.</EmptyText> : null}
      {builds.map((b) => (
        <View key={b.id} style={[local.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={{ color: theme.text, fontWeight: '800', fontSize: 17 }}>
            {b.version} <Text style={{ color: theme.muted, fontWeight: '400', fontSize: 14 }}>· {shortDate(b.date)}</Text>
          </Text>
          {b.notes ? <Text style={{ color: theme.text }}>{b.notes}</Text> : <Text style={{ color: theme.muted }}>No notes.</Text>}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
            {b.url ? <Button title="Open download" variant="plain" onPress={() => openLink(b.url!)} /> : null}
            <Button title="Share notes" variant="plain" onPress={() => Share.share({ message: `${project.name} ${b.version} (${b.date})\n\n${b.notes}${b.url ? `\n\n${b.url}` : ''}` }).catch(() => {})} />
            <Button title="Delete" variant="danger" onPress={() => confirmDestructive('Delete build?', b.version, 'Delete', () => p.apply((s) => removeItem(s, 'builds', b.id)))} />
          </View>
        </View>
      ))}
    </KeyboardScroll>
  );
}

function BuildForm({ state, projectId, last, onSave, onCancel }: { state: ProjectsState; projectId: string; last?: Build; onSave: (b: Build) => void; onCancel: () => void }) {
  const theme = useTheme();
  const today = toDateKey(new Date());
  // Everything finished since the day after the last build (or ever, for the first one).
  const since = last ? fromDateKey(last.date).getTime() + 86_400_000 - 1 : 0;
  const [auto] = useState(() => changelog(state, projectId, since, Date.now()));
  const [version, setVersion] = useState(nextVersion(last?.version));
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState(auto);
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const save = () => {
    if (!version.trim()) return setError('Give it a version, e.g. 0.3.0');
    if (!isValidDateKey(date)) return setError('Use a date like 2026-11-17');
    const link = url.trim() ? normalizeUrl(url) : undefined;
    if (url.trim() && !link) return setError('The download link doesn’t look like a web link');
    onSave({ id: newId(), projectId, version: version.trim(), date, notes: notes.trim(), ...(link ? { url: link } : {}) });
  };
  return (
    <>
      <Field label="Version" value={version} onChangeText={setVersion} autoCapitalize="none" maxLength={30} />
      <DateField label="Date" value={date} onChange={setDate} />
      <Field label="What changed" value={notes} onChangeText={setNotes} multiline placeholder="Changes in this build" />
      <Text style={{ color: theme.muted, fontSize: 13 }}>
        {auto ? `Filled in from what you finished since ${last ? last.version : 'the start'}: milestones ★, features +, tasks •, bug fixes. Edit freely.` : 'Nothing ticked off since the last build. Write the changes here.'}
      </Text>
      <Field label="Download link (optional)" value={url} onChangeText={setUrl} placeholder="Drive / itch.io link" autoCapitalize="none" keyboardType="url" />
      <ErrorText>{error}</ErrorText>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Button title="Cancel" variant="plain" onPress={onCancel} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Save build" onPress={save} />
        </View>
      </View>
    </>
  );
}

const local = StyleSheet.create({ card: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 6 } });
