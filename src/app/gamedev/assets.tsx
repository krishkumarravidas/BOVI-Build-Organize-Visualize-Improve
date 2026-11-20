import { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { openLink } from '@/components/LinkList';
import { AddPanel, NotFound, Stat, StatRow, styles, useRouteProject } from '@/components/gamedev/common';
import { Chip, ChipRow, EmptyText, ErrorText, Field, ScreenHeader, SectionTitle, confirmDestructive } from '@/components/ui';
import { newId } from '@/hooks/useCollege';
import { useTheme } from '@/hooks/useTheme';
import { ASSET_SOURCES, assetTotals, creditsText, forProject, removeItem, upsertItem, type AssetItem, type AssetSource } from '@/lib/gamedev';
import { normalizeUrl } from '@/lib/links';

const money = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/** Bought / downloaded assets per project: licence, cost, used or not — and a credits list. */
export default function AssetsScreen() {
  const theme = useTheme();
  const { project, p } = useRouteProject();
  const [filter, setFilter] = useState<'all' | 'used' | 'unused'>('all');
  if (!project) return <NotFound />;
  const assets = forProject(p.state.assets, project.id);
  const t = assetTotals(assets);
  const shown = assets.filter((a) => filter === 'all' || a.status === filter);

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <ScreenHeader title={`${project.name}: assets`} />
      <StatRow>
        <Stat value={String(t.count)} label="assets" />
        <Stat value={money(t.spent)} label="spent" />
        <Stat value={String(t.unused)} label={`unused (${money(t.unusedSpent)})`} color={t.unused ? theme.danger : theme.text} />
      </StatRow>
      <Text style={{ color: theme.muted, fontSize: 13 }}>Mark what actually ships as Used. Lots of unused purchases, or a game built mostly from store packs, is worth a second look before release.</Text>
      <Button title="Share credits list" variant="plain" onPress={() => Share.share({ message: creditsText(project.name, assets) }).catch(() => {})} />
      <AddPanel label="Add asset">{(close) => <AssetForm projectId={project.id} onSave={(a) => { p.apply((s) => upsertItem(s, 'assets', a)); close(); }} onCancel={close} />}</AddPanel>
      <ChipRow>
        {(['all', 'used', 'unused'] as const).map((f) => (
          <Chip key={f} label={f[0].toUpperCase() + f.slice(1)} selected={filter === f} onPress={() => setFilter(f)} />
        ))}
      </ChipRow>
      <SectionTitle>{`${shown.length} shown`}</SectionTitle>
      {shown.length === 0 ? <EmptyText>No assets here.</EmptyText> : null}
      {shown.map((a) => (
        <View key={a.id} style={[local.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16, flex: 1 }}>{a.name}</Text>
            <Text style={{ color: theme.text, fontWeight: '700' }}>{a.cost ? money(a.cost) : 'Free'}</Text>
          </View>
          <Text style={{ color: theme.muted, fontSize: 13 }}>
            {a.source}
            {a.author ? ` · by ${a.author}` : ''}
            {a.license ? ` · ${a.license}` : ''}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Pressable
              onPress={() => p.apply((s) => upsertItem(s, 'assets', { ...a, status: a.status === 'used' ? 'unused' : 'used' }))}
              accessibilityRole="switch"
              accessibilityState={{ checked: a.status === 'used' }}
              accessibilityLabel={`${a.name} used in the game`}
              style={[local.toggle, { borderColor: theme.accent, backgroundColor: a.status === 'used' ? theme.accent : 'transparent' }]}
            >
              <Text style={{ color: a.status === 'used' ? theme.background : theme.accent, fontWeight: '700' }}>{a.status === 'used' ? 'Used ✓' : 'Not used yet'}</Text>
            </Pressable>
            {a.url ? <Button title="Open" variant="plain" onPress={() => openLink(a.url!)} /> : null}
            <Button title="Delete" variant="danger" onPress={() => confirmDestructive('Delete asset?', a.name, 'Delete', () => p.apply((s) => removeItem(s, 'assets', a.id)))} />
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function AssetForm({ projectId, onSave, onCancel }: { projectId: string; onSave: (a: AssetItem) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [source, setSource] = useState<AssetSource>('Fab');
  const [author, setAuthor] = useState('');
  const [license, setLicense] = useState('');
  const [cost, setCost] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const save = () => {
    if (!name.trim()) return setError('Name the asset');
    const n = cost.trim() ? Number(cost.replace(/[₹,\s]/g, '')) : 0;
    if (!Number.isFinite(n) || n < 0) return setError('Cost should be a number, e.g. 1200');
    const link = url.trim() ? normalizeUrl(url) : undefined;
    if (url.trim() && !link) return setError('The link doesn’t look like a web link');
    onSave({ id: newId(), projectId, name: name.trim(), source, cost: n, status: 'unused', ...(author.trim() ? { author: author.trim() } : {}), ...(license.trim() ? { license: license.trim() } : {}), ...(link ? { url: link } : {}) });
  };
  return (
    <>
      <Field label="Asset" value={name} onChangeText={setName} placeholder="e.g. Forest Environment Pack" autoFocus maxLength={80} />
      <ChipRow>
        {ASSET_SOURCES.map((s) => (
          <Chip key={s} label={s} selected={source === s} onPress={() => setSource(s)} />
        ))}
      </ChipRow>
      <Field label="Creator (for credits)" value={author} onChangeText={setAuthor} maxLength={60} />
      <Field label="Licence" value={license} onChangeText={setLicense} placeholder="e.g. Fab Standard, CC-BY 4.0" maxLength={60} />
      <Field label="Cost (₹)" value={cost} onChangeText={setCost} placeholder="0 for free" keyboardType="numeric" />
      <Field label="Link (optional)" value={url} onChangeText={setUrl} autoCapitalize="none" keyboardType="url" />
      <ErrorText>{error}</ErrorText>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Button title="Cancel" variant="plain" onPress={onCancel} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Save" onPress={save} />
        </View>
      </View>
    </>
  );
}

const local = StyleSheet.create({
  card: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 6 },
  toggle: { borderWidth: 2, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
});
