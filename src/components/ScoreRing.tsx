import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

const DOTS = 24;
const SIZE = 52;
const R = 22;

/** Ring of dots filled clockwise by `value` (0–100); shows "–" when null. */
export function ScoreRing({ value }: { value: number | null }) {
  const theme = useTheme();
  const filled = value === null ? 0 : Math.round((value / 100) * DOTS);
  const color = value === null ? theme.muted : value >= 80 ? theme.accent : value >= 40 ? theme.primary : theme.danger;
  return (
    <View style={styles.wrap} accessible accessibilityLabel={value === null ? 'Day score: nothing to do' : `Day score ${value} percent`}>
      {Array.from({ length: DOTS }, (_, i) => {
        const a = (i / DOTS) * 2 * Math.PI - Math.PI / 2;
        return (
          <View
            key={i}
            style={[
              styles.dot,
              { left: SIZE / 2 + R * Math.cos(a) - 2, top: SIZE / 2 + R * Math.sin(a) - 2, backgroundColor: i < filled ? color : theme.border },
            ]}
          />
        );
      })}
      <Text style={[styles.value, { color: theme.text }]}>{value === null ? '–' : value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', width: 4, height: 4, borderRadius: 2 },
  value: { fontSize: 16, fontWeight: '800' },
});
