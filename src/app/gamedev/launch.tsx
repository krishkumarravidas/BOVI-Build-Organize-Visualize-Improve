import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { Button } from '@/components/Button';
import { AddPanel, CheckRow, NotFound, Stat, StatRow, styles, useRouteProject } from '@/components/gamedev/common';
import { Card, DateField, ErrorText, Field, KeyboardScroll, ScreenHeader, SectionTitle, confirmDestructive, shortDate } from '@/components/ui';
import { newId } from '@/hooks/useCollege';
import { useTheme } from '@/hooks/useTheme';
import { daysBetween, isValidDateKey, toDateKey } from '@/lib/dates';
import {
  DEFAULT_WISHLIST_GOAL,
  forProject,
  launchItems,
  removeItem,
  setLaunchItem,
  upsertItem,
  wishlistRate,
  wishlistSeries,
  type LaunchItem,
  type WishlistEntry,
} from '@/lib/gamedev';

/** Steam launch checklist scheduled back from your release date, plus wishlist tracking. */
export default function LaunchScreen() {
  const theme = useTheme();
  const { project, p } = useRouteProject();
  const [launchDate, setLaunchDate] = useState(project?.launchDate ?? '');
  const [goal, setGoal] = useState(String(project?.wishlistGoal ?? DEFAULT_WISHLIST_GOAL));
  const [error, setError] = useState<string | null>(null);
  if (!project) return <NotFound />;
  const today = toDateKey(new Date());
  const items = launchItems(project, today);
  const done = items.filter((i) => i.done).length;
  const late = items.filter((i) => i.late).length;
  const wl = wishlistSeries(forProject(p.state.wishlists, project.id));
  const latest = wl[wl.length - 1];
  const rate = wishlistRate(wl);
  const goalN = project.wishlistGoal ?? DEFAULT_WISHLIST_GOAL;

  const patchProject = (patch: { launchDate?: string; wishlistGoal?: number }) =>
    p.apply((s) => ({ ...s, projects: s.projects.map((x) => (x.id === project.id ? { ...x, ...patch } : x)) }));
  const saveDate = (launchDate: string) => {
    if (launchDate && !isValidDateKey(launchDate)) return setError('Use a date like 2027-10-01, or leave it empty');
    setError(null);
    patchProject({ launchDate: launchDate || undefined });
  };
  const saveGoal = () => {
    const n = Number(goal);
    if (Number.isFinite(n) && n > 0) patchProject({ wishlistGoal: Math.round(n) });
  };

  return (
    <KeyboardScroll style={{ backgroundColor: theme.background }} contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <ScreenHeader title={`${project.name}: launch`} />
      <Card>
        <DateField label="Planned release date" value={launchDate} onChange={(v) => { setLaunchDate(v); saveDate(v); }} optional hint="Each step gets a typical date counted back from this. Change any step's date by tapping it." />
        <ErrorText>{error}</ErrorText>
        <StatRow>
          <Stat value={`${done}/${items.length}`} label="steps done" />
          <Stat value={String(late)} label="overdue" color={late ? theme.danger : theme.text} />
          <Stat value={project.launchDate ? String(Math.max(0, daysBetween(today, project.launchDate))) : '—'} label="days to launch" />
        </StatRow>
      </Card>

      <SectionTitle>Checklist</SectionTitle>
      {items.map((it) => (
        <LaunchRow
          key={it.key}
          item={it}
          onToggle={() => p.apply((s) => setLaunchItem(s, project.id, it.key, { done: !it.done }, Date.now()))}
          onDate={(date) => p.apply((s) => setLaunchItem(s, project.id, it.key, { date }, Date.now()))}
        />
      ))}

      <SectionTitle>Wishlists</SectionTitle>
      <Card>
        <StatRow>
          <Stat value={latest ? latest.wishlists.toLocaleString() : '—'} label="wishlists" />
          <Stat value={rate === null ? '—' : `${rate >= 0 ? '+' : ''}${Math.round(rate)}`} label="per week" color={rate !== null && rate < 0 ? theme.danger : theme.text} />
          <Stat value={latest ? `${Math.min(100, Math.round((latest.wishlists / goalN) * 100))}%` : '0%'} label={`of ${goalN.toLocaleString()} goal`} />
        </StatRow>
        {wl.length >= 2 ? <WishlistChart entries={wl} goal={goalN} /> : <Text style={{ color: theme.muted }}>Log your Steamworks numbers once a week to see the trend.</Text>}
        {latest && rate && rate > 0 && latest.wishlists < goalN ? (
          <Text style={{ color: theme.muted }}>At this rate you reach {goalN.toLocaleString()} in about {Math.ceil((goalN - latest.wishlists) / rate)} weeks.</Text>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: theme.text, fontWeight: '600' }}>Goal</Text>
          <TextInput
            value={goal}
            onChangeText={setGoal}
            onBlur={saveGoal}
            onSubmitEditing={saveGoal}
            keyboardType="numeric"
            accessibilityLabel="Wishlist goal"
            style={{ flex: 1, borderWidth: 1, borderRadius: 10, padding: 8, color: theme.text, borderColor: theme.border }}
          />
        </View>
      </Card>
      <AddPanel label="Log wishlists">
        {(close) => (
          <WishlistForm
            projectId={project.id}
            onSave={(e) => {
              p.apply((s) => upsertItem(s, 'wishlists', e));
              close();
            }}
            onCancel={close}
          />
        )}
      </AddPanel>
      {[...wl].reverse().slice(0, 12).map((e) => (
        <Pressable
          key={e.id}
          onLongPress={() => confirmDestructive('Delete entry?', `${e.date}: ${e.wishlists}`, 'Delete', () => p.apply((s) => removeItem(s, 'wishlists', e.id)))}
          accessibilityHint="Long-press to delete"
        >
          <Text style={{ color: theme.muted }}>
            {shortDate(e.date)} · {e.wishlists.toLocaleString()} wishlists{e.followers ? ` · ${e.followers.toLocaleString()} followers` : ''}
          </Text>
        </Pressable>
      ))}
    </KeyboardScroll>
  );
}

function LaunchRow({ item, onToggle, onDate }: { item: LaunchItem; onToggle: () => void; onDate: (d: string | null) => void }) {
  const theme = useTheme();
  const [editing, setEditing] = useState(false);
  const detail = `${item.date ? shortDate(item.date) : 'Set a release date'}${item.late ? ' · overdue' : ''}${item.hint ? `\n${item.hint}` : ''}`;
  return (
    <View style={{ gap: 6 }}>
      <CheckRow done={item.done} title={item.title} detail={detail} onToggle={onToggle} onPress={() => setEditing((e) => !e)} color={item.late ? theme.danger : theme.accent} />
      {editing ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 38 }}>
          <DateField
            value={item.date ?? ''}
            onChange={(v) => {
              if (v && !isValidDateKey(v)) return;
              onDate(v || null);
              setEditing(false);
            }}
            optional
            accessibilityLabel={`Date for ${item.title}`}
            style={{ flex: 1 }}
          />
        </View>
      ) : null}
    </View>
  );
}

function WishlistForm({ projectId, onSave, onCancel }: { projectId: string; onSave: (e: WishlistEntry) => void; onCancel: () => void }) {
  const [date, setDate] = useState(toDateKey(new Date()));
  const [wishlists, setWishlists] = useState('');
  const [followers, setFollowers] = useState('');
  const [error, setError] = useState<string | null>(null);
  const save = () => {
    const w = Number(wishlists.replace(/[,\s]/g, ''));
    const f = followers.trim() ? Number(followers.replace(/[,\s]/g, '')) : undefined;
    if (!isValidDateKey(date)) return setError('Use a date like 2026-11-17');
    if (!Number.isFinite(w) || w < 0) return setError('Enter the total wishlists from Steamworks');
    if (f !== undefined && (!Number.isFinite(f) || f < 0)) return setError('Followers should be a number');
    onSave({ id: newId(), projectId, date, wishlists: Math.round(w), ...(f !== undefined ? { followers: Math.round(f) } : {}) });
  };
  return (
    <>
      <DateField label="Date" value={date} onChange={setDate} />
      <Field label="Total wishlists" value={wishlists} onChangeText={setWishlists} keyboardType="numeric" autoFocus />
      <Field label="Followers (optional)" value={followers} onChangeText={setFollowers} keyboardType="numeric" />
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

function WishlistChart({ entries, goal }: { entries: WishlistEntry[]; goal: number }) {
  const theme = useTheme();
  const W = 300;
  const H = 120;
  const pad = 6;
  const max = Math.max(goal, ...entries.map((e) => e.wishlists)) * 1.05;
  const t0 = new Date(entries[0].date).getTime();
  const t1 = Math.max(t0 + 1, new Date(entries[entries.length - 1].date).getTime());
  const x = (d: string) => pad + ((new Date(d).getTime() - t0) / (t1 - t0)) * (W - 2 * pad);
  const y = (v: number) => H - pad - (v / max) * (H - 2 * pad);
  const pts = entries.map((e) => `${x(e.date)},${y(e.wishlists)}`).join(' ');
  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} accessibilityLabel={`Wishlists from ${entries[0].wishlists} to ${entries[entries.length - 1].wishlists}`}>
      <Line x1={pad} x2={W - pad} y1={y(goal)} y2={y(goal)} stroke={theme.accent} strokeDasharray="4 4" strokeWidth={1} />
      <SvgText x={W - pad} y={y(goal) - 4} fill={theme.accent} fontSize={10} textAnchor="end">
        goal
      </SvgText>
      <Polyline points={pts} fill="none" stroke={theme.primary} strokeWidth={2.5} />
      {entries.map((e) => (
        <Circle key={e.id} cx={x(e.date)} cy={y(e.wishlists)} r={3} fill={theme.primary} />
      ))}
    </Svg>
  );
}
