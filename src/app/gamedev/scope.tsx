import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { AddPanel, BarChart, CheckRow, NotFound, Stat, StatRow, styles, useRouteProject } from '@/components/gamedev/common';
import { Card, Chip, ChipRow, ErrorText, Field, ScreenHeader, SectionTitle, confirmDestructive, shortDate } from '@/components/ui';
import { newId } from '@/hooks/useCollege';
import { useTheme } from '@/hooks/useTheme';
import { isValidDateKey, toDateKey } from '@/lib/dates';
import {
  FEATURE_HOURS,
  PRIORITY_LABEL,
  PRIORITY_ORDER,
  VERTICAL_SLICE,
  dateLabel,
  forecast,
  scopeCheck,
  setFeatures,
  weeklyFocusHours,
  weeklyStats,
  type Feature,
  type FeaturePriority,
  type FeatureSize,
} from '@/lib/gamedev';
import { withDone } from '@/lib/projects';

const SIZES: FeatureSize[] = ['S', 'M', 'L'];

/** Feature list with Must/Should/Could/Cut lines, a deadline check and a pace-based forecast. */
export default function ScopeScreen() {
  const theme = useTheme();
  const { project, p } = useRouteProject();
  const [deadline, setDeadline] = useState(project?.deadline ?? '');
  const [deadlineError, setDeadlineError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  if (!project) return <NotFound />;

  const today = toDateKey(new Date());
  const features = project.features ?? [];
  const pace = weeklyFocusHours(p.state, project.id, now);
  const check = scopeCheck(features, project.deadline, pace, today);
  const stats = weeklyStats(p.state, project.id, today, 8);
  const openMust = features.filter((f) => !f.done && f.priority === 'must').length;
  const fc = forecast(openMust, stats, today);
  const update = (fn: (fs: Feature[]) => Feature[]) => p.apply((s) => setFeatures(s, project.id, fn));
  const patch = (id: string, change: Partial<Feature>) => update((fs) => fs.map((f) => (f.id === id ? { ...f, ...change } : f)));
  const cutSet = new Set(check.suggestCuts.map((f) => f.id));

  const saveDeadline = () => {
    if (deadline && !isValidDateKey(deadline)) return setDeadlineError('Use a date like 2027-03-31, or leave it empty');
    setDeadlineError(null);
    p.apply((s) => ({ ...s, projects: s.projects.map((x) => (x.id === project.id ? { ...x, deadline: deadline || undefined } : x)) }));
  };

  const addSlice = () => {
    const existing = new Set(project.milestones.map((m) => m.title));
    const missing = VERTICAL_SLICE.filter((t) => !existing.has(t));
    missing.forEach((t) => p.addMilestone(project.id, { title: t }));
  };
  const hasSlice = VERTICAL_SLICE.every((t) => project.milestones.some((m) => m.title === t));

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <ScreenHeader title={`${project.name}: scope`} />

      <Card>
        <Field label="Deadline" value={deadline} onChangeText={setDeadline} onBlur={saveDeadline} onSubmitEditing={saveDeadline} placeholder="YYYY-MM-DD (vertical slice, demo, launch…)" autoCapitalize="none" />
        <ErrorText>{deadlineError}</ErrorText>
        <StatRow>
          <Stat value={`${check.hours.must}h`} label="Must left" color={check.mustFits === false ? theme.danger : theme.text} />
          <Stat value={`${check.hours.should}h`} label="Should" />
          <Stat value={`${check.hours.could}h`} label="Could" />
          <Stat value={check.capacity === null ? '—' : `${Math.round(check.capacity)}h`} label="You have" color={check.fits === false ? theme.danger : check.fits ? theme.accent : theme.text} />
        </StatRow>
        <Text style={{ color: theme.muted }}>
          {check.capacity === null
            ? 'Set a deadline to see whether the scope fits.'
            : `${Math.round((check.weeksLeft ?? 0) * 10) / 10} weeks left at ${Math.round(check.weeklyHours * 10) / 10} h/week${check.assumedPace ? ' (assumed — log focus sessions on this project to measure your real pace)' : ' (your last 4 weeks of focus)'}.`}
        </Text>
        {check.mustFits === false ? (
          <Text style={{ color: theme.danger, fontWeight: '700' }}>Even the Musts don’t fit. Move the deadline, or demote some Musts.</Text>
        ) : check.fits === false ? (
          <Text style={{ color: theme.danger, fontWeight: '700' }}>
            Doesn’t fit. Cut {check.suggestCuts.map((f) => f.title).join(', ')} and it does.
          </Text>
        ) : check.fits ? (
          <Text style={{ color: theme.accent, fontWeight: '700' }}>Fits, with {Math.round((check.capacity ?? 0) - check.hours.must - check.hours.should - check.hours.could)} h to spare.</Text>
        ) : null}
        <Text style={{ color: theme.muted, fontSize: 12 }}>Sizes: S ≈ {FEATURE_HOURS.S} h, M ≈ {FEATURE_HOURS.M} h, L ≈ {FEATURE_HOURS.L} h.</Text>
      </Card>

      {PRIORITY_ORDER.map((pr) => {
        const list = features.filter((f) => f.priority === pr);
        if (!list.length && pr === 'cut') return null;
        return (
          <View key={pr} style={{ gap: 6 }}>
            <SectionTitle>{`${PRIORITY_LABEL[pr]} · ${list.filter((f) => f.done).length}/${list.length}`}</SectionTitle>
            {!list.length ? <Text style={{ color: theme.muted }}>Nothing here yet.</Text> : null}
            {list.map((f) => (
              <FeatureRow
                key={f.id}
                feature={f}
                suggestCut={cutSet.has(f.id)}
                onToggle={() => update((fs) => fs.map((x) => (x.id === f.id ? withDone(x, !x.done, Date.now()) : x)))}
                onPriority={(priority) => patch(f.id, { priority })}
                onSize={(size) => patch(f.id, { size })}
                onDelete={() => confirmDestructive('Delete feature?', f.title, 'Delete', () => update((fs) => fs.filter((x) => x.id !== f.id)))}
              />
            ))}
          </View>
        );
      })}

      <AddPanel label="Add feature">{(close) => <NewFeature onAdd={(f) => update((fs) => [...fs, f])} onClose={close} />}</AddPanel>

      <SectionTitle>Pace</SectionTitle>
      <Card>
        <Text style={{ color: theme.text, fontWeight: '700' }}>Things finished per week</Text>
        <BarChart values={stats.map((s) => s.done)} labels={stats.map((s) => shortWeek(s.week))} />
        <Text style={{ color: theme.text, fontWeight: '700' }}>Focus hours per week</Text>
        <BarChart values={stats.map((s) => Math.round((s.focusMin / 60) * 10) / 10)} labels={stats.map((s) => shortWeek(s.week))} color={theme.accent} />
        <Text style={{ color: theme.muted }}>
          {openMust === 0
            ? 'All Musts are done.'
            : fc.date
              ? `${openMust} Must${openMust === 1 ? '' : 's'} left. At ${Math.round(fc.perWeek * 10) / 10} things/week they land around ${shortDate(fc.date)}${project.deadline ? (fc.date <= project.deadline ? ' — before your deadline.' : ` — after your deadline (${dateLabel(project.deadline)}).`) : '.'}`
              : `${openMust} Must${openMust === 1 ? '' : 's'} left. Tick off tasks and features for a few weeks to get a forecast.`}
        </Text>
      </Card>

      <SectionTitle>Vertical slice</SectionTitle>
      <Card>
        <Text style={{ color: theme.muted }}>Adds the standard slice milestones (core loop, one level, one enemy, one key moment, menus, final-quality area, packaged build) to this project’s roadmap.</Text>
        <Button title={hasSlice ? 'Slice milestones added ✓' : 'Add vertical-slice milestones'} variant="plain" onPress={addSlice} disabled={hasSlice} />
      </Card>
    </ScrollView>
  );
}

function shortWeek(week: string): string {
  const [, m, d] = week.split('-').map(Number);
  return `${d}/${m}`;
}

function FeatureRow({
  feature: f,
  suggestCut,
  onToggle,
  onPriority,
  onSize,
  onDelete,
}: {
  feature: Feature;
  suggestCut: boolean;
  onToggle: () => void;
  onPriority: (p: FeaturePriority) => void;
  onSize: (s: FeatureSize) => void;
  onDelete: () => void;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <CheckRow
        done={f.done}
        title={f.title}
        detail={`${f.size} · ~${FEATURE_HOURS[f.size]} h${suggestCut ? ' · suggested cut' : ''}`}
        onToggle={onToggle}
        onPress={() => setOpen((o) => !o)}
        color={f.priority === 'must' ? theme.primary : theme.accent}
        right={suggestCut ? <Text style={{ color: theme.danger, fontWeight: '700' }}>✂</Text> : null}
      />
      {open ? (
        <View style={{ gap: 8, paddingLeft: 38 }}>
          <ChipRow>
            {PRIORITY_ORDER.map((pr) => (
              <Chip key={pr} label={PRIORITY_LABEL[pr]} selected={f.priority === pr} onPress={() => onPriority(pr)} />
            ))}
          </ChipRow>
          <ChipRow>
            {SIZES.map((s) => (
              <Chip key={s} label={s} selected={f.size === s} onPress={() => onSize(s)} />
            ))}
            <Pressable onPress={onDelete} accessibilityRole="button" accessibilityLabel={`Delete ${f.title}`} style={{ justifyContent: 'center', paddingHorizontal: 8 }}>
              <Text style={{ color: theme.danger, fontWeight: '600' }}>Delete</Text>
            </Pressable>
          </ChipRow>
        </View>
      ) : null}
    </View>
  );
}

function NewFeature({ onAdd, onClose }: { onAdd: (f: Feature) => void; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<FeaturePriority>('must');
  const [size, setSize] = useState<FeatureSize>('M');
  const add = () => {
    if (!title.trim()) return;
    onAdd({ id: newId(), title: title.trim(), priority, size, done: false });
    setTitle('');
  };
  return (
    <>
      <Field label="Feature" value={title} onChangeText={setTitle} placeholder="e.g. Enemy follows sounds" autoFocus onSubmitEditing={add} maxLength={80} />
      <ChipRow>
        {PRIORITY_ORDER.map((pr) => (
          <Chip key={pr} label={PRIORITY_LABEL[pr]} selected={priority === pr} onPress={() => setPriority(pr)} />
        ))}
      </ChipRow>
      <ChipRow>
        {SIZES.map((s) => (
          <Chip key={s} label={`${s} · ~${FEATURE_HOURS[s]}h`} selected={size === s} onPress={() => setSize(s)} />
        ))}
      </ChipRow>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Button title="Done" variant="plain" onPress={onClose} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Add" onPress={add} disabled={!title.trim()} />
        </View>
      </View>
    </>
  );
}
