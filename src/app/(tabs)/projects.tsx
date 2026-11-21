import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { LinkChips } from '@/components/LinkList';
import { CheckRow, Heatmap } from '@/components/gamedev/common';
import { useCommitCache } from '@/hooks/useCommitCache';
import { toDateKey } from '@/lib/dates';
import { activityByDay, daysSinceActive, featuredJam, jamHeadline, nudgeFor, streak, thisWeek, weekTasks } from '@/lib/gamedev';
import { commitDays, projectRepo, repoKey } from '@/lib/github';
import { Card, EmptyText, ListRow, SectionTitle, shortDate } from '@/components/ui';
import { useProjects } from '@/hooks/useProjects';
import { useTheme } from '@/hooks/useTheme';
import { STATUS_LABEL, groupProjects, nextMilestone, taskProgress, type Project } from '@/lib/projects';

function subtitleFor(p: Project): string | undefined {
  const m = nextMilestone(p);
  const parts = [p.nextStep ? `Next: ${p.nextStep}` : '', p.date ? shortDate(p.date) : '', m ? `Milestone: ${m.title}` : ''].filter(Boolean);
  return parts.length ? parts.join(' · ') : p.summary;
}

export default function ProjectsScreen() {
  const theme = useTheme();
  const { projects, ready, toggleTask, state } = useProjects();
  const [cache] = useCommitCache();
  const [now] = useState(() => Date.now());
  if (!ready) return <View style={{ flex: 1, backgroundColor: theme.background }} />;
  const today = toDateKey(new Date());
  const commitDaysFor = (p: Project) => {
    const r = projectRepo(p);
    return r ? commitDays(cache[repoKey(r.ref)]?.commits ?? []) : [];
  };
  const allCommitDays = projects.flatMap(commitDaysFor);
  const activity = activityByDay(state, undefined, allCommitDays);
  const days = streak(activity, today);
  const planned = weekTasks(state, thisWeek(today));
  const jam = featuredJam(state.jams, now);

  const groups = groupProjects(projects);
  const active = groups.find((g) => g.status === 'active')?.projects ?? [];
  const rest = groups.filter((g) => g.status !== 'active');
  const open = (id: string) => router.push({ pathname: '/project/[id]', params: { id } });

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={[styles.content, { paddingTop: 8 }]}>

      {jam ? (
        <Pressable onPress={() => router.push('/gamedev/jams')} accessibilityRole="button" style={[styles.banner, { backgroundColor: theme.surface, borderColor: theme.accent }]}>
          <Ionicons name="trophy" size={18} color={theme.accent} />
          <Text style={{ color: theme.text, fontWeight: '700', flex: 1 }}>{jamHeadline(jam, now)}</Text>
        </Pressable>
      ) : null}

      <Card>
        <View style={styles.cardHead}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>This week</Text>
          <View style={{ flexDirection: 'row' }}>
            <Button title="Review" variant="plain" onPress={() => router.push('/review')} />
            <Button title={planned.length ? 'Edit plan' : 'Plan week'} variant="plain" onPress={() => router.push('/gamedev/plan')} />
          </View>
        </View>
        {planned.length === 0 ? <Text style={{ color: theme.muted }}>Pick 3–5 tasks to finish this week.</Text> : null}
        {planned.map((x) => (
          <CheckRow key={`${x.project.id}/${x.task.id}`} done={x.task.done} title={x.task.title} detail={x.project.name} onToggle={() => toggleTask(x.project.id, x.task.id)} />
        ))}
        {planned.length ? <Text style={{ color: theme.muted }}>{planned.filter((x) => x.task.done).length} of {planned.length} done</Text> : null}
      </Card>

      <Card>
        <View style={styles.cardHead}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            <Ionicons name="flame" size={18} color={days ? theme.danger : theme.muted} /> {days ? `${days}-day streak` : 'No streak yet'}
          </Text>
          <Text style={{ color: theme.muted, fontSize: 12 }}>{activity.has(today) ? 'worked today' : 'not yet today'}</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentOffset={{ x: 10_000, y: 0 }}>
          <Heatmap days={activity} today={today} />
        </ScrollView>
        {active.map((p) => {
          const msg = nudgeFor(p.name, daysSinceActive(activityByDay(state, p.id, commitDaysFor(p)), today));
          return msg ? (
            <Text key={p.id} style={{ color: theme.danger, fontWeight: '600' }}>
              {msg}
            </Text>
          ) : null;
        })}
        <Text style={{ color: theme.muted, fontSize: 12 }}>Counts focus sessions, devlog entries, finished tasks/features/bugs, builds, playtests and GitHub commits.</Text>
      </Card>

      <View style={styles.tools}>
        {[
          { label: 'Plan week', icon: 'calendar' as const, to: '/gamedev/plan' as const },
          { label: 'Learning', icon: 'school' as const, to: '/gamedev/learning' as const },
          { label: 'Game jams', icon: 'trophy' as const, to: '/gamedev/jams' as const },
        ].map((t) => (
          <Pressable key={t.to} onPress={() => router.push(t.to)} accessibilityRole="button" style={[styles.tool, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name={t.icon} size={18} color={theme.primary} />
            <Text style={{ color: theme.text, fontWeight: '600' }}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <SectionTitle>Focus</SectionTitle>
      {active.length === 0 ? <EmptyText>No active project. Set one to Active to focus on it.</EmptyText> : null}
      {active.map((p) => {
        const prog = taskProgress(p);
        return (
          <Card key={p.id}>
            <Text style={[styles.focusName, { color: theme.text }]} onPress={() => open(p.id)} accessibilityRole="button">
              {p.name}
            </Text>
            {p.summary ? <Text style={{ color: theme.muted }}>{p.summary}</Text> : null}
            {p.nextStep ? <Text style={{ color: theme.text }}>Next: {p.nextStep}</Text> : null}
            {nextMilestone(p) ? <Text style={{ color: theme.accent, fontWeight: '600' }}>Milestone: {nextMilestone(p)!.title}</Text> : null}
            <LinkChips links={p.links} />
            {p.tasks.map((t) => (
              <CheckRow key={t.id} done={t.done} title={t.title} onToggle={() => toggleTask(p.id, t.id)} color={theme.primary} />
            ))}
            {prog.total ? <Text style={{ color: theme.muted }}>{prog.done} of {prog.total} tasks done</Text> : null}
            <Button title="Open project" variant="plain" onPress={() => open(p.id)} />
          </Card>
        );
      })}

      {rest.map((g) => (
        <View key={g.status} style={{ gap: 10 }}>
          <SectionTitle>{STATUS_LABEL[g.status]}</SectionTitle>
          {g.projects.map((p) => {
            const prog = taskProgress(p);
            return (
              <ListRow
                key={p.id}
                title={p.name}
                subtitle={subtitleFor(p)}
                detail={p.nextStep ? p.summary : undefined}
                color={g.status === 'parked' || g.status === 'done' ? theme.muted : theme.accent}
                muted={g.status === 'done'}
                badge={prog.total ? { text: `${prog.done}/${prog.total}`, tone: 'muted' } : undefined}
                onPress={() => open(p.id)}
              />
            );
          })}
        </View>
      ))}

      <Button title="Add project" onPress={() => open('new')} />

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 10 },
  title: { fontSize: 34, fontWeight: '800' },
  focusName: { fontSize: 20, fontWeight: '800' },
  task: { fontSize: 16, paddingVertical: 4 },
  done: { textDecorationLine: 'line-through' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 17, fontWeight: '800' },
  tools: { flexDirection: 'row', gap: 8 },
  tool: { flex: 1, alignItems: 'center', gap: 4, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingVertical: 10 },
});
