import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { NotFound, Stat, StatRow, severityColor, styles, useRouteProject } from '@/components/gamedev/common';
import { Chip, ChipRow, EmptyText, ScreenHeader } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { SEVERITY_LABEL, forProject, setBugStatus, sortedBugs } from '@/lib/gamedev';

/** A project's bugs: open first by severity; tap to edit, tick to mark fixed. */
export default function BugsScreen() {
  const theme = useTheme();
  const { project, p } = useRouteProject();
  const [filter, setFilter] = useState<'open' | 'fixed'>('open');
  if (!project) return <NotFound />;
  const all = forProject(p.state.bugs, project.id);
  const list = sortedBugs(all.filter((b) => b.status === filter));
  const open = all.filter((b) => b.status === 'open');
  const edit = (bug: string) => router.push({ pathname: '/gamedev/bug', params: { id: project.id, bug } });

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.screen}>
      <ScreenHeader title={`${project.name}: bugs`} />
      <StatRow>
        <Stat value={String(open.length)} label="open" color={open.length ? theme.danger : theme.accent} />
        <Stat value={String(open.filter((b) => b.severity === 'crash' || b.severity === 'high').length)} label="crash / high" />
        <Stat value={String(all.length - open.length)} label="fixed" />
      </StatRow>
      <Button title="Report a bug" onPress={() => edit('new')} />
      <ChipRow>
        <Chip label={`Open (${open.length})`} selected={filter === 'open'} onPress={() => setFilter('open')} />
        <Chip label={`Fixed (${all.length - open.length})`} selected={filter === 'fixed'} onPress={() => setFilter('fixed')} />
      </ChipRow>
      {list.length === 0 ? <EmptyText>{filter === 'open' ? 'No open bugs. Nice.' : 'Nothing fixed yet.'}</EmptyText> : null}
      {list.map((b) => (
        <Pressable
          key={b.id}
          onPress={() => edit(b.id)}
          accessibilityRole="button"
          accessibilityLabel={`${SEVERITY_LABEL[b.severity]} bug: ${b.title}`}
          style={[local.row, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <View style={[local.sev, { backgroundColor: severityColor(b.severity, theme) }]} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: b.status === 'fixed' ? theme.muted : theme.text, fontSize: 16, fontWeight: '600', textDecorationLine: b.status === 'fixed' ? 'line-through' : 'none' }}>{b.title}</Text>
            <Text style={{ color: theme.muted, fontSize: 12 }}>
              {SEVERITY_LABEL[b.severity]} · {new Date(b.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
              {b.fixedAt ? ` · fixed ${new Date(b.fixedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : ''}
            </Text>
          </View>
          {b.image ? <Image source={{ uri: b.image }} style={local.thumb} accessibilityIgnoresInvertColors /> : null}
          <Pressable
            onPress={() => p.apply((s) => setBugStatus(s, b.id, b.status === 'open' ? 'fixed' : 'open', Date.now()))}
            accessibilityRole="button"
            accessibilityLabel={b.status === 'open' ? `Mark ${b.title} fixed` : `Reopen ${b.title}`}
            hitSlop={8}
            style={[local.fix, { borderColor: theme.accent, backgroundColor: b.status === 'fixed' ? theme.accent : 'transparent' }]}
          >
            <Text style={{ color: b.status === 'fixed' ? theme.background : theme.accent, fontWeight: '800' }}>✓</Text>
          </Pressable>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const local = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  sev: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  thumb: { width: 44, height: 44, borderRadius: 8 },
  fix: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
