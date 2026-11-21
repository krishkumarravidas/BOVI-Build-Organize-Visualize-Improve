import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { Button } from '@/components/Button';
import { useProjects } from '@/hooks/useProjects';
import { useTheme } from '@/hooks/useTheme';
import { heatmapWeeks, type BugSeverity } from '@/lib/gamedev';
import type { Project } from '@/lib/projects';
import type { DateKey } from '@/lib/types';

/** The project named by the `id` route param, plus the projects store. */
export function useRouteProject(): { project: Project | undefined; id: string; p: ReturnType<typeof useProjects> } {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = useProjects();
  return { project: p.projects.find((x) => x.id === id), id: id ?? '', p };
}

export function severityColor(sev: BugSeverity, theme: ReturnType<typeof useTheme>): string {
  return sev === 'crash' || sev === 'high' ? theme.danger : sev === 'medium' ? theme.primary : theme.muted;
}

export function NotFound({ what = 'project' }: { what?: string }) {
  const theme = useTheme();
  return <Text style={{ color: theme.muted, padding: 16 }}>This {what} no longer exists.</Text>;
}

/** A round tickable row with title, optional detail and trailing content. */
export function CheckRow({
  done,
  title,
  detail,
  onToggle,
  onPress,
  right,
  color,
  label,
}: {
  done: boolean;
  title: string;
  detail?: string;
  onToggle: () => void;
  onPress?: () => void;
  right?: ReactNode;
  color?: string;
  label?: string;
}) {
  const theme = useTheme();
  const c = color ?? theme.accent;
  return (
    <View style={styles.checkRow}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={label ?? title}
        hitSlop={8}
        style={[styles.check, { borderColor: c, backgroundColor: done ? c : 'transparent' }]}
      >
        {done ? <Ionicons name="checkmark" size={16} color={theme.background} /> : null}
      </Pressable>
      <Pressable style={{ flex: 1 }} onPress={onPress ?? onToggle} disabled={!onPress && !onToggle} accessibilityRole={onPress ? 'button' : undefined}>
        <Text style={[styles.checkTitle, { color: done ? theme.muted : theme.text }, done && styles.strike]}>{title}</Text>
        {detail ? <Text style={{ color: theme.muted, fontSize: 13 }}>{detail}</Text> : null}
      </Pressable>
      {right}
    </View>
  );
}

/** "+ Add …" button that expands into a form; `children` gets a close callback. */
export function AddPanel({ label, children }: { label: string; children: (close: () => void) => ReactNode }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  if (!open) return <Button title={`+ ${label}`} variant="plain" onPress={() => setOpen(true)} />;
  return <View style={[styles.panel, { borderColor: theme.border, backgroundColor: theme.surface }]}>{children(() => setOpen(false))}</View>;
}

/** Small labelled number, for summary rows. */
export function Stat({ value, label, color }: { value: string; label: string; color?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: color ?? theme.text }]}>{value}</Text>
      <Text style={{ color: theme.muted, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

export function StatRow({ children }: { children: ReactNode }) {
  return <View style={styles.statRow}>{children}</View>;
}

/** Simple vertical bars with labels under them. */
export function BarChart({ values, labels, color, height = 80, format }: { values: number[]; labels: string[]; color?: string; height?: number; format?: (v: number) => string }) {
  const theme = useTheme();
  const max = Math.max(1, ...values);
  return (
    <View style={{ gap: 4 }} accessible accessibilityLabel={values.map((v, i) => `${labels[i]}: ${format ? format(v) : v}`).join(', ')}>
      <View style={[styles.bars, { height }]}>
        {values.map((v, i) => (
          <View key={i} style={styles.barCol}>
            {v > 0 ? <Text style={{ color: theme.muted, fontSize: 10 }}>{format ? format(v) : v}</Text> : null}
            <View style={{ width: '70%', height: Math.max(v > 0 ? 3 : 1, (v / max) * (height - 16)), backgroundColor: v > 0 ? (color ?? theme.primary) : theme.border, borderRadius: 3 }} />
          </View>
        ))}
      </View>
      <View style={styles.barLabels}>
        {labels.map((l, i) => (
          <Text key={i} style={[styles.barLabel, { color: theme.muted }]} numberOfLines={1}>
            {l}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** GitHub-style activity grid: columns are weeks (Mon at top), darker = more done that day. */
export function Heatmap({ days, today, weeks = 17 }: { days: ReadonlyMap<DateKey, number>; today: DateKey; weeks?: number }) {
  const theme = useTheme();
  const cols = heatmapWeeks(today, weeks);
  const cell = 13;
  const gap = 3;
  const levels = [theme.border, `${theme.accent}55`, `${theme.accent}99`, theme.accent];
  const level = (n: number) => (n <= 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : 3);
  const active = [...days.keys()].filter((d) => d >= cols[0][0] && d <= today).length;
  return (
    <View accessible accessibilityLabel={`Active on ${active} of the last ${weeks * 7} days`}>
      <Svg width={cols.length * (cell + gap)} height={7 * (cell + gap)}>
        {cols.map((col, x) =>
          col.map((d, y) =>
            d > today ? null : (
              <Rect key={d} x={x * (cell + gap)} y={y * (cell + gap)} width={cell} height={cell} rx={3} fill={levels[level(days.get(d) ?? 0)]} stroke={d === today ? theme.text : 'none'} strokeWidth={d === today ? 1 : 0} />
            ),
          ),
        )}
      </Svg>
    </View>
  );
}

export const styles = StyleSheet.create({
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 40 },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkTitle: { fontSize: 16 },
  strike: { textDecorationLine: 'line-through' },
  panel: { gap: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 12 },
  stat: { flex: 1, minWidth: 70, gap: 2 },
  statValue: { fontSize: 22, fontWeight: '800' },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 2 },
  barLabels: { flexDirection: 'row', gap: 4 },
  barLabel: { flex: 1, fontSize: 10, textAlign: 'center' },
  screen: { padding: 16, gap: 12, paddingBottom: 48 },
});
