import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import type { Weekday } from '@/lib/types';

const LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface Props {
  value: Weekday[];
  onChange: (days: Weekday[]) => void;
}

export function DayPicker({ value, onChange }: Props) {
  const theme = useTheme();
  const toggle = (d: Weekday) => {
    const next = value.includes(d) ? value.filter((x) => x !== d) : [...value, d];
    onChange(next.sort((a, b) => a - b) as Weekday[]);
  };
  return (
    <View style={styles.row}>
      {LABELS.map((label, i) => {
        const day = i as Weekday;
        const on = value.includes(day);
        return (
          <Pressable
            key={i}
            onPress={() => toggle(day)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={NAMES[i]}
            style={[
              styles.chip,
              { borderColor: theme.primary, backgroundColor: on ? theme.primary : 'transparent' },
            ]}
          >
            <Text style={{ color: on ? theme.onPrimary : theme.text, fontWeight: '700' }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  chip: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
