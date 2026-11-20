import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { AddPanel, NotFound, Stat, StatRow, styles, useRouteProject } from '@/components/gamedev/common';
import { Chip, ChipRow, EmptyText, ErrorText, Field, ScreenHeader, SectionTitle, confirmDestructive, shortDate } from '@/components/ui';
import { newId } from '@/hooks/useCollege';
import { useTheme } from '@/hooks/useTheme';
import { isValidDateKey, toDateKey } from '@/lib/dates';
import { forProject, lastBuild, playtestSummary, removeItem, upsertItem, type Playtest } from '@/lib/gamedev';

/** Who tested which build, and where they got scared, confused or bored. */
export default function PlaytestsScreen() {
  const theme = useTheme();
  const { project, p } = useRouteProject();
  if (!project) return <NotFound />;
  const tests = forProject(p.state.playtests, project.id).sort((a, b) => b.date.localeCompare(a.date));
  const sum = playtestSummary(tests);
  const defaultBuild = lastBuild(p.state, project.id)?.version;

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <ScreenHeader title={`${project.name}: playtests`} />
      <StatRow>
        <Stat value={String(sum.count)} label="sessions" />
        <Stat value={String(sum.testers)} label="testers" />
        <Stat value={sum.avgFun === null ? '—' : `${Math.round(sum.avgFun * 10) / 10}/5`} label="avg fun" color={sum.avgFun !== null && sum.avgFun < 3 ? theme.danger : theme.text} />
      </StatRow>
      <AddPanel label="Log a playtest">{(close) => <PlaytestForm projectId={project.id} defaultBuild={defaultBuild} onSave={(t) => { p.apply((s) => upsertItem(s, 'playtests', t)); close(); }} onCancel={close} />}</AddPanel>

      {tests.some((t) => t.scared) ? (
        <>
          <SectionTitle>Where they got scared</SectionTitle>
          {tests.filter((t) => t.scared).map((t) => <Quote key={`s${t.id}`} text={t.scared!} by={t.tester} color={theme.danger} />)}
        </>
      ) : null}
      {tests.some((t) => t.confused || t.bored) ? (
        <>
          <SectionTitle>Confused / bored</SectionTitle>
          {tests.filter((t) => t.confused).map((t) => <Quote key={`c${t.id}`} text={`Confused: ${t.confused}`} by={t.tester} color={theme.primary} />)}
          {tests.filter((t) => t.bored).map((t) => <Quote key={`b${t.id}`} text={`Bored: ${t.bored}`} by={t.tester} color={theme.muted} />)}
        </>
      ) : null}

      <SectionTitle>Sessions</SectionTitle>
      {tests.length === 0 ? <EmptyText>No playtests yet. Watch someone play without helping, and note where they react.</EmptyText> : null}
      {tests.map((t) => (
        <View key={t.id} style={[local.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: theme.text, fontWeight: '700', flex: 1 }}>
              {t.tester || 'Someone'} · {shortDate(t.date)}
              {t.build ? ` · ${t.build}` : ''}
            </Text>
            {t.fun ? <Text style={{ color: theme.accent, fontWeight: '700' }}>{'★'.repeat(t.fun)}</Text> : null}
          </View>
          {t.notes ? <Text style={{ color: theme.text }}>{t.notes}</Text> : null}
          <Button title="Delete" variant="danger" onPress={() => confirmDestructive('Delete playtest?', `${t.tester} · ${t.date}`, 'Delete', () => p.apply((s) => removeItem(s, 'playtests', t.id)))} />
        </View>
      ))}
    </ScrollView>
  );
}

function Quote({ text, by, color }: { text: string; by: string; color: string }) {
  const theme = useTheme();
  return (
    <View style={[local.quote, { borderColor: color }]}>
      <Text style={{ color: theme.text }}>{text}</Text>
      {by ? <Text style={{ color: theme.muted, fontSize: 12 }}>— {by}</Text> : null}
    </View>
  );
}

function PlaytestForm({ projectId, defaultBuild, onSave, onCancel }: { projectId: string; defaultBuild?: string; onSave: (t: Playtest) => void; onCancel: () => void }) {
  const theme = useTheme();
  const [date, setDate] = useState(toDateKey(new Date()));
  const [tester, setTester] = useState('');
  const [build, setBuild] = useState(defaultBuild ?? '');
  const [scared, setScared] = useState('');
  const [confused, setConfused] = useState('');
  const [bored, setBored] = useState('');
  const [notes, setNotes] = useState('');
  const [fun, setFun] = useState<number | undefined>();
  const [error, setError] = useState<string | null>(null);
  const save = () => {
    if (!isValidDateKey(date)) return setError('Use a date like 2026-11-17');
    if (!tester.trim()) return setError('Who played?');
    const opt = (v: string) => v.trim() || undefined;
    onSave({ id: newId(), projectId, date, tester: tester.trim(), build: opt(build), scared: opt(scared), confused: opt(confused), bored: opt(bored), notes: opt(notes), fun });
  };
  return (
    <>
      <Field label="Tester" value={tester} onChangeText={setTester} placeholder="Name" autoFocus maxLength={40} />
      <Field label="Date" value={date} onChangeText={setDate} autoCapitalize="none" />
      <Field label="Build" value={build} onChangeText={setBuild} placeholder="e.g. 0.3.1" autoCapitalize="none" />
      <Field label="Where did they get scared?" value={scared} onChangeText={setScared} placeholder="e.g. Jumped when the bell rang in the corridor" multiline />
      <Field label="Where were they confused?" value={confused} onChangeText={setConfused} placeholder="e.g. Didn’t know the lamp could be picked up" multiline />
      <Field label="Where were they bored?" value={bored} onChangeText={setBored} placeholder="e.g. Long walk to the second area" multiline />
      <Field label="Other notes" value={notes} onChangeText={setNotes} multiline />
      <Text style={{ fontWeight: '700', color: theme.text }}>Fun</Text>
      <ChipRow>
        {[1, 2, 3, 4, 5].map((n) => (
          <Chip key={n} label={`${n}★`} selected={fun === n} onPress={() => setFun(fun === n ? undefined : n)} />
        ))}
      </ChipRow>
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
  quote: { borderLeftWidth: 3, paddingLeft: 10, gap: 2 },
});
