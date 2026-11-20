import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { forProject, lastBuild, launchItems, scopeCheck, weeklyFocusHours } from '@/lib/gamedev';
import { projectRepo } from '@/lib/github';
import type { Project, ProjectsState } from '@/lib/projects';
import type { DateKey } from '@/lib/types';

interface Tile {
  route: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  alert?: boolean;
}

/** The project's workspace: one tile per tool, each with a live summary. */
export function WorkspaceTiles({ project, state, today, now }: { project: Project; state: ProjectsState; today: DateKey; now: number }) {
  const theme = useTheme();
  const features = project.features ?? [];
  const musts = features.filter((f) => f.priority === 'must');
  const check = scopeCheck(features, project.deadline, weeklyFocusHours(state, project.id, now), today);
  const bugs = forProject(state.bugs, project.id).filter((b) => b.status === 'open');
  const crit = bugs.filter((b) => b.severity === 'crash' || b.severity === 'high').length;
  const tests = forProject(state.playtests, project.id).length;
  const build = lastBuild(state, project.id);
  const assets = forProject(state.assets, project.id);
  const refs = forProject(state.refs, project.id).length;
  const launch = launchItems(project, today);
  const late = launch.filter((i) => i.late).length;
  const repo = projectRepo(project);

  const tiles: Tile[] = [
    { route: 'scope', icon: 'cut', label: 'Scope', value: features.length ? `${musts.filter((f) => f.done).length}/${musts.length} musts${check.fits === false ? ' · over' : ''}` : 'Plan features', alert: check.fits === false },
    { route: 'bugs', icon: 'bug', label: 'Bugs', value: bugs.length ? `${bugs.length} open${crit ? ` · ${crit} high` : ''}` : 'None open', alert: crit > 0 },
    { route: 'playtests', icon: 'people', label: 'Playtests', value: tests ? `${tests} logged` : 'None yet' },
    { route: 'builds', icon: 'cube', label: 'Builds', value: build ? build.version : 'None yet' },
    { route: 'assets', icon: 'pricetags', label: 'Assets', value: assets.length ? `${assets.length} · ₹${Math.round(assets.reduce((a, x) => a + x.cost, 0)).toLocaleString('en-IN')}` : 'Track buys' },
    { route: 'refs', icon: 'images', label: 'References', value: refs ? `${refs} images` : 'Mood board' },
    { route: 'launch', icon: 'rocket', label: 'Steam launch', value: project.launchDate ? `${launch.filter((i) => i.done).length}/${launch.length}${late ? ` · ${late} late` : ''}` : 'Set a date', alert: late > 0 },
    { route: 'commits', icon: 'git-commit', label: 'Commits', value: repo ? `${repo.ref.repo}` : 'Link a repo' },
  ];

  return (
    <View style={styles.grid}>
      {tiles.map((t) => (
        <Pressable
          key={t.route}
          onPress={() => router.push({ pathname: `/gamedev/${t.route}`, params: { id: project.id } } as unknown as Href)}
          accessibilityRole="button"
          accessibilityLabel={`${t.label}: ${t.value}`}
          style={({ pressed }) => [styles.tile, { backgroundColor: theme.surface, borderColor: t.alert ? theme.danger : theme.border, opacity: pressed ? 0.7 : 1 }]}
        >
          <Ionicons name={t.icon} size={18} color={t.alert ? theme.danger : theme.primary} />
          <Text style={[styles.label, { color: theme.text }]}>{t.label}</Text>
          <Text style={{ color: t.alert ? theme.danger : theme.muted, fontSize: 12 }} numberOfLines={1}>
            {t.value}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '48%', flexGrow: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 10, gap: 2, minHeight: 72 },
  label: { fontSize: 15, fontWeight: '700' },
});
