import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card, Chip, ChipRow, Field } from '@/components/ui';
import { useCollege } from '@/hooks/useCollege';
import { useProjects } from '@/hooks/useProjects';
import { useTheme } from '@/hooks/useTheme';
import { focusRemainingMs, STATUS_ORDER } from '@/lib/projects';

const DURATIONS = [25, 50, 90];

const mmss = (ms: number) => {
  const total = Math.ceil(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

/**
 * Pomodoro-style timer tied to a project (game dev) or a subject (`kind="study"`). Time is derived from
 * timestamps, so it survives app restarts. Only one session runs at a time, whichever kind it is.
 */
export function FocusTimer({ kind = 'project', initialSubjectId }: { kind?: 'project' | 'study'; initialSubjectId?: string }) {
  const theme = useTheme();
  const p = useProjects();
  const { college } = useCollege();
  const [subjectId, setSubjectId] = useState<string | undefined>(initialSubjectId);
  const subject = college.subjects.find((x) => x.id === (subjectId ?? college.subjects[0]?.id));
  const active = p.state.activeFocus;
  const [now, setNow] = useState(() => Date.now());
  const candidates = [...p.projects]
    .filter((x) => x.status !== 'done' && x.status !== 'parked')
    .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));
  // 'none' = explicitly no project; null = not chosen yet (default to the top project once loaded).
  const [chosen, setChosen] = useState<string | null>(null);
  const projectId = chosen === 'none' ? undefined : (chosen ?? candidates[0]?.id);
  const setProjectId = (id: string | undefined) => setChosen(id ?? 'none');
  const [minutes, setMinutes] = useState(25);
  const [intent, setIntent] = useState('');
  const [outcome, setOutcome] = useState('');
  const [next, setNext] = useState('');

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);

  if (active) {
    const left = focusRemainingMs(active, now);
    const name = active.subjectId
      ? `Study · ${college.subjects.find((x) => x.id === active.subjectId)?.name ?? 'subject'}`
      : (p.projects.find((x) => x.id === active.projectId)?.name ?? 'No project');
    const finished = left === 0;
    return (
      <Card>
        <Text style={{ color: theme.muted, fontWeight: '600' }}>{finished ? 'SESSION DONE' : 'FOCUSING'}</Text>
        <Text style={[styles.time, { color: finished ? theme.accent : theme.text }]} accessibilityRole="timer" accessibilityLabel={`${mmss(left)} left`}>
          {mmss(left)}
        </Text>
        <Text style={{ color: theme.muted }}>
          {name} · {active.minutes} min
        </Text>
        {active.intent ? <Text style={{ color: theme.text, fontSize: 16 }}>Goal: {active.intent}</Text> : null}
        <Button title="Stop and save" onPress={p.stopFocus} />
        <Text style={{ color: theme.muted, fontSize: 12 }}>Saved automatically when the time is up, even if you close BOVI.</Text>
      </Card>
    );
  }
  const last = p.lastFocus;
  const lastName = last
    ? last.subjectId
      ? (college.subjects.find((x) => x.id === last.subjectId)?.name ?? 'study')
      : (p.projects.find((x) => x.id === last.projectId)?.name ?? 'no project')
    : '';
  const selected = p.projects.find((x) => x.id === projectId);

  if (last && last.minutes > 0 && last.projectId) {
    // Post-session note: becomes a devlog entry, and "next" becomes the project's next step.
    return (
      <Card>
        <Text style={{ color: theme.accent, fontWeight: '700' }}>Saved {last.minutes} min to {lastName}.</Text>
        {last.intent ? <Text style={{ color: theme.muted }}>You planned: {last.intent}</Text> : null}
        <Field label="What happened?" value={outcome} onChangeText={setOutcome} placeholder="e.g. Patrol works; door AI still clips" multiline />
        <Field label="What’s next?" value={next} onChangeText={setNext} placeholder="Becomes the project’s next step" />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Button
              title="Skip"
              variant="plain"
              onPress={() => {
                p.clearLastFocus();
                setOutcome('');
                setNext('');
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title="Save to devlog"
              onPress={() => {
                p.saveSessionNote(outcome, next);
                setOutcome('');
                setNext('');
              }}
            />
          </View>
        </View>
      </Card>
    );
  }

  if (kind === 'study') {
    return (
      <Card>
        <Text style={{ color: theme.muted, fontWeight: '600' }}>STUDY TIMER</Text>
        {last ? (
          <Text style={{ color: last.minutes ? theme.accent : theme.muted, fontWeight: '600' }}>
            {last.minutes ? `Saved ${last.minutes} min to ${lastName}.` : 'Under 30 seconds, so it wasn’t saved.'}
          </Text>
        ) : null}
        {college.subjects.length === 0 ? <Text style={{ color: theme.muted }}>Add subjects first (Classes → Subjects).</Text> : null}
        <ChipRow>
          {college.subjects.map((x) => (
            <Chip key={x.id} label={x.short} color={x.color} selected={subject?.id === x.id} onPress={() => setSubjectId(x.id)} />
          ))}
        </ChipRow>
        <ChipRow>
          {DURATIONS.map((d) => (
            <Chip key={d} label={`${d} min`} selected={minutes === d} onPress={() => setMinutes(d)} />
          ))}
        </ChipRow>
        <Field label="What will you study?" value={intent} onChangeText={setIntent} placeholder="e.g. Module 3: graphs, BFS/DFS" maxLength={120} />
        <Button
          title="Start studying"
          disabled={!subject}
          onPress={() => {
            setNow(Date.now());
            p.startFocus(undefined, minutes, intent, subject?.id);
            setIntent('');
          }}
        />
        <Text style={{ color: theme.muted, fontSize: 12 }}>Counts towards exam readiness, and ticks off today’s planned revision session for the subject.</Text>
      </Card>
    );
  }

  return (
    <Card>
      <Text style={{ color: theme.muted, fontWeight: '600' }}>FOCUS TIMER</Text>
      {last ? (
        <Text style={{ color: last.minutes ? theme.accent : theme.muted, fontWeight: '600' }}>
          {last.minutes ? `Saved ${last.minutes} min to ${lastName}.` : 'Under 30 seconds, so it wasn’t saved.'}
        </Text>
      ) : null}
      <ChipRow>
        {candidates.slice(0, 6).map((x) => (
          <Chip key={x.id} label={x.name.length > 22 ? `${x.name.slice(0, 21)}…` : x.name} selected={projectId === x.id} onPress={() => setProjectId(x.id)} />
        ))}
        <Chip label="No project" selected={!projectId} onPress={() => setProjectId(undefined)} />
      </ChipRow>
      <View style={styles.row}>
        <ChipRow>
          {DURATIONS.map((d) => (
            <Chip key={d} label={`${d} min`} selected={minutes === d} onPress={() => setMinutes(d)} />
          ))}
        </ChipRow>
      </View>
      <Field label="What will you do?" value={intent} onChangeText={setIntent} placeholder={selected?.nextStep ? `e.g. ${selected.nextStep}` : 'One concrete goal for this session'} maxLength={120} />
      {selected?.nextStep && !intent ? <Chip label={`Use: ${selected.nextStep.length > 40 ? `${selected.nextStep.slice(0, 39)}…` : selected.nextStep}`} selected={false} onPress={() => setIntent(selected.nextStep ?? '')} /> : null}
      <Button
        title="Start focus"
        onPress={() => {
          setNow(Date.now());
          p.startFocus(projectId, minutes, intent);
          setIntent('');
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  time: { fontSize: 52, fontWeight: '800', fontVariant: ['tabular-nums'] },
  row: { gap: 8 },
});
