import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { CheckRow, styles } from '@/components/gamedev/common';
import { Card, ScreenHeader, SectionTitle } from '@/components/ui';
import { useProjects } from '@/hooks/useProjects';
import { useTheme } from '@/hooks/useTheme';
import { addDays, isValidDateKey, toDateKey } from '@/lib/dates';
import { dateLabel, prunePlan, thisWeek, togglePick, weekTasks } from '@/lib/gamedev';

const TARGET = 5;

/** Pick 3–5 tasks for the week across your projects. Sunday evening's reminder brings you here. */
export default function PlanScreen() {
  const theme = useTheme();
  const p = useProjects();
  const today = toDateKey(new Date());
  const params = useLocalSearchParams<{ week?: string }>();
  const [week, setWeek] = useState(() => (params.week && isValidDateKey(params.week) ? thisWeek(params.week) : thisWeek(today)));
  const picked = weekTasks(p.state, week);
  const pickedKeys = new Set(picked.map((x) => `${x.project.id}/${x.task.id}`));
  const projects = p.projects.filter((x) => x.status !== 'done' && x.status !== 'parked');
  const done = picked.filter((x) => x.task.done).length;
  const toggle = (projectId: string, taskId: string) => p.apply((s) => prunePlan(togglePick(s, { week, projectId, taskId }), today));

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <ScreenHeader title="Plan the week" />
      <View style={local.weekRow}>
        <Button title="‹" variant="plain" onPress={() => setWeek(addDays(week, -7))} />
        <Text style={{ color: theme.text, fontWeight: '700', flex: 1, textAlign: 'center' }}>
          {week === thisWeek(today) ? 'This week' : week === addDays(thisWeek(today), 7) ? 'Next week' : 'Week'} · {dateLabel(week)} – {dateLabel(addDays(week, 6))}
        </Text>
        <Button title="›" variant="plain" onPress={() => setWeek(addDays(week, 7))} />
      </View>
      <Card>
        <Text style={{ color: theme.text, fontWeight: '700' }}>
          {picked.length === 0 ? 'Nothing planned yet' : `${done} of ${picked.length} done`}
        </Text>
        {picked.map((x) => (
          <CheckRow key={`${x.project.id}/${x.task.id}`} done={x.task.done} title={x.task.title} detail={x.project.name} onToggle={() => p.toggleTask(x.project.id, x.task.id)} />
        ))}
        <Text style={{ color: picked.length > TARGET ? theme.danger : theme.muted, fontSize: 13 }}>
          {picked.length > TARGET ? `${picked.length} picked. Solo, with college, 3–5 is realistic.` : 'Aim for 3–5 tasks you can really finish alongside college.'}
        </Text>
      </Card>

      {projects.map((proj) => {
        const open = proj.tasks.filter((t) => !t.done || pickedKeys.has(`${proj.id}/${t.id}`));
        return (
          <View key={proj.id} style={{ gap: 6 }}>
            <SectionTitle>{proj.name}</SectionTitle>
            {open.length === 0 ? <Text style={{ color: theme.muted }}>No open tasks.</Text> : null}
            {open.map((t) => (
              <CheckRow
                key={t.id}
                done={pickedKeys.has(`${proj.id}/${t.id}`)}
                title={t.title}
                label={`Plan ${t.title} this week`}
                onToggle={() => toggle(proj.id, t.id)}
                color={theme.primary}
              />
            ))}
            <QuickTask onAdd={(title) => p.addTask(proj.id, title)} />
          </View>
        );
      })}
    </ScrollView>
  );
}

function QuickTask({ onAdd }: { onAdd: (title: string) => void }) {
  const theme = useTheme();
  const [text, setText] = useState('');
  const add = () => {
    if (!text.trim()) return;
    onAdd(text);
    setText('');
  };
  return (
    <TextInput
      value={text}
      onChangeText={setText}
      onSubmitEditing={add}
      placeholder="+ New task"
      placeholderTextColor={theme.muted}
      accessibilityLabel="New task"
      returnKeyType="done"
      style={[local.input, { color: theme.text, borderColor: theme.border }]}
    />
  );
}

const local = StyleSheet.create({
  weekRow: { flexDirection: 'row', alignItems: 'center' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 15 },
});
