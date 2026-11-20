import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useTheme } from '@/hooks/useTheme';
import { fromDateKey } from '@/lib/dates';
import type { DateKey } from '@/lib/types';

const SIZE = 46;
const R = 19;
const C = 2 * Math.PI * R;

/** A week of day chips, each ringed by that day's progress. */
export function DayRings({
  days,
  selected,
  today,
  progress,
  onSelect,
  onPrevWeek,
  onNextWeek,
}: {
  days: DateKey[];
  selected: DateKey;
  today: DateKey;
  progress: Record<DateKey, number | null>;
  onSelect: (d: DateKey) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.row, { backgroundColor: theme.background, borderColor: theme.border }]}>
      <Pressable onPress={onPrevWeek} accessibilityRole="button" accessibilityLabel="Previous week" hitSlop={8}>
        <Ionicons name="chevron-back" size={18} color={theme.muted} />
      </Pressable>
      {days.map((d) => {
        const p = progress[d];
        const on = d === selected;
        const date = fromDateKey(d);
        const color = p === null || p === undefined ? theme.muted : p >= 80 ? theme.accent : p >= 40 ? theme.primary : theme.danger;
        return (
          <Pressable
            key={d}
            onPress={() => onSelect(d)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}${p === null || p === undefined ? '' : `, ${p}% done`}`}
            style={[styles.cell, on && { backgroundColor: theme.surface }]}
          >
            <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
              <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={theme.border} strokeWidth={3} fill="none" />
              {p ? (
                <Circle
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={R}
                  stroke={color}
                  strokeWidth={3}
                  fill="none"
                  strokeDasharray={`${(C * p) / 100} ${C}`}
                  strokeLinecap="round"
                  transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
                />
              ) : null}
            </Svg>
            <Text style={[styles.wd, { color: d === today ? theme.danger : theme.muted }]}>{date.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase().slice(0, 3)}</Text>
            <Text style={[styles.num, { color: theme.text, fontWeight: on ? '800' : '600' }]}>{date.getDate()}</Text>
          </Pressable>
        );
      })}
      <Pressable onPress={onNextWeek} accessibilityRole="button" accessibilityLabel="Next week" hitSlop={8}>
        <Ionicons name="chevron-forward" size={18} color={theme.muted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth },
  cell: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, alignItems: 'center', justifyContent: 'center' },
  wd: { fontSize: 8, fontWeight: '700' },
  num: { fontSize: 14, marginTop: -1 },
});
