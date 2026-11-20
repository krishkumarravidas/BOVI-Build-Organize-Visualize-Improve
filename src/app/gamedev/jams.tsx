import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { openLink } from '@/components/LinkList';
import { AddPanel, styles } from '@/components/gamedev/common';
import { Card, Chip, ChipRow, EmptyText, ErrorText, Field, ScreenHeader, SectionTitle, confirmDestructive } from '@/components/ui';
import { newId } from '@/hooks/useCollege';
import { useProjects } from '@/hooks/useProjects';
import { useTheme } from '@/hooks/useTheme';
import { atTime, isValidDateKey } from '@/lib/dates';
import { JAM_SCOPE_LIMITS, jamHeadline, jamPhases, jamStatus, removeItem, upsertItem, type GameJam } from '@/lib/gamedev';
import { normalizeUrl } from '@/lib/links';

const fmt = (ms: number) => new Date(ms).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** Game jams: countdown to the theme, a phase plan across the jam, scope limits and reminders. */
export default function JamsScreen() {
  const theme = useTheme();
  const p = useProjects();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const jams = [...(p.state.jams ?? [])].sort((a, b) => a.start - b.start);
  const current = jams.filter((j) => jamStatus(j, now).state !== 'ended');
  const past = jams.filter((j) => jamStatus(j, now).state === 'ended').reverse();

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <ScreenHeader title="Game jams" />
      <AddPanel label="Add a jam">{(close) => <JamForm onSave={(j) => { p.apply((s) => upsertItem(s, 'jams', j)); close(); }} onCancel={close} />}</AddPanel>
      {current.length === 0 ? <EmptyText>No upcoming jams. Add one to get a countdown, a phase plan and reminders (theme reveal, scope check, 2 hours left).</EmptyText> : null}
      {current.map((j) => (
        <JamCard key={j.id} jam={j} now={now} onTheme={(theme) => p.apply((s) => upsertItem(s, 'jams', { ...j, theme }))} onDelete={() => confirmDestructive('Delete jam?', j.name, 'Delete', () => p.apply((s) => removeItem(s, 'jams', j.id)))} />
      ))}
      {past.length ? <SectionTitle>Past jams</SectionTitle> : null}
      {past.map((j) => (
        <Text key={j.id} style={{ color: theme.muted }} onLongPress={() => confirmDestructive('Delete jam?', j.name, 'Delete', () => p.apply((s) => removeItem(s, 'jams', j.id)))}>
          {j.name} · {new Date(j.start).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
          {j.theme ? ` · “${j.theme}”` : ''}
        </Text>
      ))}
    </ScrollView>
  );
}

function JamCard({ jam, now, onTheme, onDelete }: { jam: GameJam; now: number; onTheme: (t: string) => void; onDelete: () => void }) {
  const theme = useTheme();
  const [themeText, setThemeText] = useState(jam.theme ?? '');
  const st = jamStatus(jam, now);
  const phases = jamPhases(jam);
  return (
    <Card>
      <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800' }}>{jam.name}</Text>
      <Text style={{ color: st.state === 'running' ? theme.accent : theme.primary, fontWeight: '700' }}>{jamHeadline(jam, now)}</Text>
      <Text style={{ color: theme.muted }}>
        {fmt(jam.start)} → {fmt(jam.start + jam.hours * 3_600_000)} ({jam.hours} h)
      </Text>
      <Field label="Theme" value={themeText} onChangeText={setThemeText} onBlur={() => themeText.trim() !== (jam.theme ?? '') && onTheme(themeText.trim())} placeholder={st.state === 'upcoming' ? 'Revealed at the start' : 'Type the theme'} />
      <SectionTitle>Plan</SectionTitle>
      {phases.map((ph) => {
        const live = now >= ph.start && now < ph.end;
        const over = now >= ph.end;
        return (
          <View key={ph.title} style={[local.phase, { borderColor: live ? theme.accent : theme.border, opacity: over ? 0.5 : 1 }]}>
            <Text style={{ color: live ? theme.accent : theme.text, fontWeight: '700' }}>
              {ph.title}
              {live ? ' · now' : ''}
            </Text>
            <Text style={{ color: theme.muted, fontSize: 12 }}>
              {fmt(ph.start)} – {new Date(ph.end).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
            </Text>
            <Text style={{ color: theme.muted, fontSize: 13 }}>{ph.hint}</Text>
          </View>
        );
      })}
      <SectionTitle>Scope limits</SectionTitle>
      {JAM_SCOPE_LIMITS.map((l) => (
        <Text key={l} style={{ color: theme.text }}>
          • {l}
        </Text>
      ))}
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {jam.url ? <Button title="Jam page" variant="plain" onPress={() => openLink(jam.url!)} /> : null}
        <Button title="Delete" variant="danger" onPress={onDelete} />
      </View>
    </Card>
  );
}

function JamForm({ onSave, onCancel }: { onSave: (j: GameJam) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('18:00');
  const [hours, setHours] = useState(48);
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const save = () => {
    if (!name.trim()) return setError('Name the jam, e.g. GMTK Game Jam');
    if (!isValidDateKey(date)) return setError('Start date like 2026-12-05');
    if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(time)) return setError('Start time like 18:00 (24h)');
    const link = url.trim() ? normalizeUrl(url) : undefined;
    if (url.trim() && !link) return setError('The link doesn’t look like a web link');
    onSave({ id: newId(), name: name.trim(), start: atTime(date, time.padStart(5, '0')).getTime(), hours, ...(link ? { url: link } : {}) });
  };
  return (
    <>
      <Field label="Jam" value={name} onChangeText={setName} placeholder="e.g. GMTK Game Jam" autoFocus maxLength={60} />
      <Field label="Start date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" autoCapitalize="none" />
      <Field label="Start time (your time)" value={time} onChangeText={setTime} placeholder="HH:mm" autoCapitalize="none" hint="When the theme is revealed, in your local time." />
      <ChipRow>
        {[24, 48, 72, 168].map((h) => (
          <Chip key={h} label={h === 168 ? '1 week' : `${h} h`} selected={hours === h} onPress={() => setHours(h)} />
        ))}
      </ChipRow>
      <Field label="Jam page (optional)" value={url} onChangeText={setUrl} placeholder="itch.io/jam/…" autoCapitalize="none" keyboardType="url" />
      <ErrorText>{error}</ErrorText>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Button title="Cancel" variant="plain" onPress={onCancel} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Add jam" onPress={save} />
        </View>
      </View>
    </>
  );
}

const local = StyleSheet.create({ phase: { borderLeftWidth: 3, paddingLeft: 10, gap: 2 } });
