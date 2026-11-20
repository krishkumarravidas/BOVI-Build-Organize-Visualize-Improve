import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { LinkList } from '@/components/LinkList';
import { WorkspaceTiles } from '@/components/gamedev/WorkspaceTiles';
import { Chip, ChipRow, ErrorText, Field, FormScreen, ScreenHeader, SectionTitle, confirmDestructive, shortDate } from '@/components/ui';
import { newId } from '@/hooks/useCollege';
import { useProjects } from '@/hooks/useProjects';
import { useTheme } from '@/hooks/useTheme';
import { addDays, isValidDateKey, toDateKey } from '@/lib/dates';
import { STATUS_LABEL, STATUS_ORDER, devlogMarkdown, focusMinutesByProject, setProjectLinks, sortedLog, sortedMilestones, validateProject, type ProjectStatus } from '@/lib/projects';

export default function ProjectFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const p = useProjects();
  const existing = id === 'new' ? undefined : p.projects.find((x) => x.id === id);

  const [name, setName] = useState(existing?.name ?? '');
  const [status, setStatus] = useState<ProjectStatus>(existing?.status ?? 'planned');
  const [summary, setSummary] = useState(existing?.summary ?? '');
  const [nextStep, setNextStep] = useState(existing?.nextStep ?? '');
  const [date, setDate] = useState(existing?.date ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [newTask, setNewTask] = useState('');
  const [msTitle, setMsTitle] = useState('');
  const [msDue, setMsDue] = useState('');
  const [msError, setMsError] = useState<string | null>(null);
  const [logText, setLogText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const today = toDateKey(new Date());

  if (id !== 'new' && !existing) {
    return (
      <FormScreen>
        <ScreenHeader title="Project" modal />
        <Text style={{ color: theme.muted }}>This project no longer exists.</Text>
      </FormScreen>
    );
  }

  const save = () => {
    const err = validateProject({ name });
    if (err) return setError(err);
    if (date && !isValidDateKey(date)) return setError('Use a date like 2026-11-19, or leave it empty');
    p.save({
      id: existing?.id ?? newId(),
      name,
      status,
      summary: summary.trim() || undefined,
      nextStep: nextStep.trim() || undefined,
      date: date || undefined,
      notes: notes.trim() || undefined,
      tasks: existing?.tasks ?? [],
    });
    router.back();
  };

  const addMilestone = () => {
    if (!existing || !msTitle.trim()) return;
    if (msDue && !isValidDateKey(msDue)) return setMsError('Use a date like 2026-12-15, or leave it empty');
    p.addMilestone(existing.id, { title: msTitle, due: msDue || undefined });
    setMsTitle('');
    setMsDue('');
    setMsError(null);
  };
  const addLog = () => {
    if (!existing || !logText.trim()) return;
    p.addLog(existing.id, logText);
    setLogText('');
  };
  const shareDevlog = () => {
    if (!existing) return;
    const today = toDateKey(new Date());
    Share.share({ message: devlogMarkdown(existing, addDays(today, -6), today), title: `${existing.name} devlog` }).catch(() => {});
  };
  const focusTotal = existing ? (focusMinutesByProject(p.state, 0, Number.MAX_SAFE_INTEGER).get(existing.id) ?? 0) : 0;

  const addTask = () => {
    if (!existing || !newTask.trim()) return;
    p.addTask(existing.id, newTask);
    setNewTask('');
  };

  return (
    <FormScreen>
      <ScreenHeader title={existing ? 'Edit project' : 'New project'} modal />
      {existing ? (
        <>
          <SectionTitle>Workspace</SectionTitle>
          <WorkspaceTiles project={existing} state={p.state} today={today} now={now} />
        </>
      ) : null}
      <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. My first game, Portfolio site" maxLength={80} />
      <SectionTitle>Status</SectionTitle>
      <ChipRow>
        {STATUS_ORDER.map((s) => (
          <Chip key={s} label={STATUS_LABEL[s]} selected={s === status} onPress={() => setStatus(s)} />
        ))}
      </ChipRow>
      <Field label="Summary" value={summary} onChangeText={setSummary} placeholder="e.g. Steam · first-person horror" maxLength={120} />
      <Field label="Next step" value={nextStep} onChangeText={setNextStep} placeholder="What's the very next thing?" maxLength={160} />
      <Field label="Date (optional)" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" autoCapitalize="none" hint="When the next step starts or is due." />
      <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="Decisions, ideas" multiline />

      <SectionTitle>Links</SectionTitle>
      {existing ? (
        <LinkList
          links={existing.links}
          onChange={(links) => p.apply((st) => setProjectLinks(st, existing.id, links))}
          emptyText="GitHub repo, Drive folder, design doc, itch.io / Steam page…"
          addHint="Saved straight away. Opens in the GitHub / Drive app if installed."
        />
      ) : (
        <Text style={{ color: theme.muted }}>Save the project first, then add links.</Text>
      )}

      <SectionTitle>Tasks</SectionTitle>
      {existing ? (
        <>
          {existing.tasks.map((t) => (
            <View key={t.id} style={styles.taskRow}>
              <Pressable
                onPress={() => p.toggleTask(existing.id, t.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: t.done }}
                accessibilityLabel={t.title}
                style={[styles.check, { borderColor: theme.primary, backgroundColor: t.done ? theme.primary : 'transparent' }]}
              >
                {t.done ? <Text style={{ color: theme.onPrimary, fontWeight: '800' }}>✓</Text> : null}
              </Pressable>
              <Text style={[styles.taskText, { color: t.done ? theme.muted : theme.text }, t.done && styles.done]}>{t.title}</Text>
              <Pressable onPress={() => p.removeTask(existing.id, t.id)} accessibilityRole="button" accessibilityLabel={`Delete task ${t.title}`} hitSlop={8}>
                <Text style={{ color: theme.danger, fontSize: 18 }}>✕</Text>
              </Pressable>
            </View>
          ))}
          <View style={styles.taskRow}>
            <TextInput
              value={newTask}
              onChangeText={setNewTask}
              onSubmitEditing={addTask}
              placeholder="Add a task"
              placeholderTextColor={theme.muted}
              accessibilityLabel="New task"
              returnKeyType="done"
              style={[styles.taskInput, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
            />
            <Button title="Add" variant="plain" onPress={addTask} />
          </View>
        </>
      ) : (
        <Text style={{ color: theme.muted }}>Save the project first, then add tasks.</Text>
      )}

      {existing ? (
        <>
          <SectionTitle>Milestones</SectionTitle>
          {sortedMilestones(existing).map((m) => (
            <View key={m.id} style={styles.taskRow}>
              <Pressable
                onPress={() => p.toggleMilestone(existing.id, m.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: m.done }}
                accessibilityLabel={`Milestone ${m.title}`}
                style={[styles.check, { borderColor: theme.accent, backgroundColor: m.done ? theme.accent : 'transparent' }]}
              >
                {m.done ? <Text style={{ color: theme.background, fontWeight: '800' }}>✓</Text> : null}
              </Pressable>
              <Text style={[styles.taskText, { color: m.done ? theme.muted : theme.text }, m.done && styles.done]}>
                {m.title}
                {m.due ? <Text style={{ color: theme.muted }}>{`  ·  ${shortDate(m.due)}`}</Text> : null}
              </Text>
              <Pressable onPress={() => p.removeMilestone(existing.id, m.id)} accessibilityRole="button" accessibilityLabel={`Delete milestone ${m.title}`} hitSlop={8}>
                <Text style={{ color: theme.danger, fontSize: 18 }}>✕</Text>
              </Pressable>
            </View>
          ))}
          <View style={styles.taskRow}>
            <TextInput
              value={msTitle}
              onChangeText={setMsTitle}
              placeholder="New milestone, e.g. Vertical slice"
              placeholderTextColor={theme.muted}
              accessibilityLabel="New milestone"
              style={[styles.taskInput, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
            />
          </View>
          <View style={styles.taskRow}>
            <TextInput
              value={msDue}
              onChangeText={setMsDue}
              placeholder="Target date (optional) YYYY-MM-DD"
              placeholderTextColor={theme.muted}
              accessibilityLabel="Milestone date"
              autoCapitalize="none"
              style={[styles.taskInput, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
            />
            <Button title="Add" variant="plain" onPress={addMilestone} />
          </View>
          <ErrorText>{msError}</ErrorText>

          <SectionTitle right={<Button title="Share week" variant="plain" onPress={shareDevlog} />}>Devlog</SectionTitle>
          {focusTotal ? <Text style={{ color: theme.muted }}>Focus logged on this project: {Math.round((focusTotal / 60) * 10) / 10} h</Text> : null}
          <TextInput
            value={logText}
            onChangeText={setLogText}
            placeholder="What did you do today? What's next?"
            placeholderTextColor={theme.muted}
            accessibilityLabel="Devlog entry"
            multiline
            style={[styles.taskInput, styles.logInput, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
          />
          <Button title="Add entry" variant="plain" onPress={addLog} />
          {sortedLog(existing)
            .slice(0, 20)
            .map((e) => (
              <View key={e.id} style={[styles.logEntry, { borderColor: theme.border }]}>
                <View style={styles.taskRow}>
                  <Text style={{ color: theme.muted, fontWeight: '700', flex: 1 }}>{shortDate(e.date)}</Text>
                  <Pressable onPress={() => p.removeLog(existing.id, e.id)} accessibilityRole="button" accessibilityLabel={`Delete entry from ${shortDate(e.date)}`} hitSlop={8}>
                    <Text style={{ color: theme.danger }}>✕</Text>
                  </Pressable>
                </View>
                <Text style={{ color: theme.text, fontSize: 15 }}>{e.text}</Text>
              </View>
            ))}
        </>
      ) : null}

      <ErrorText>{error}</ErrorText>
      <Button title="Save" onPress={save} />
      {existing ? (
        <Button
          title="Delete project"
          variant="danger"
          onPress={() =>
            confirmDestructive('Delete project?', `"${existing.name}" and its tasks will be removed.`, 'Delete', () => {
              p.remove(existing.id);
              router.back();
            })
          }
        />
      ) : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  check: { width: 26, height: 26, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  taskText: { flex: 1, fontSize: 16 },
  done: { textDecorationLine: 'line-through' },
  taskInput: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  logInput: { minHeight: 80, textAlignVertical: 'top', flex: 0 },
  logEntry: { borderLeftWidth: 3, paddingLeft: 10, gap: 2 },
});
