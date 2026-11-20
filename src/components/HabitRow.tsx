import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

interface Props {
  name: string;
  done: boolean;
  streak: number;
  onToggle: () => void;
  onPress: () => void;
}

export function HabitRow({ name, done, streak, onToggle, onPress }: Props) {
  const theme = useTheme();
  return (
    <View style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Pressable
        onPress={onToggle}
        hitSlop={8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={`${name}, ${done ? 'completed' : 'not completed'}`}
        style={[
          styles.check,
          { borderColor: theme.primary, backgroundColor: done ? theme.primary : 'transparent' },
        ]}
      >
        {done ? <Text style={[styles.checkMark, { color: theme.onPrimary }]}>✓</Text> : null}
      </Pressable>
      <Pressable onPress={onPress} style={styles.body} accessibilityRole="button" accessibilityHint="Edit habit">
        <Text
          style={[styles.name, { color: done ? theme.muted : theme.text }, done && styles.nameDone]}
          numberOfLines={1}
        >
          {name}
        </Text>
        {streak > 0 ? (
          <Text style={{ color: theme.muted }}>
            {streak}-day streak
          </Text>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  check: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { fontWeight: '800', fontSize: 16, lineHeight: 18 },
  body: { flex: 1, gap: 2 },
  name: { fontSize: 17, fontWeight: '600' },
  nameDone: { textDecorationLine: 'line-through' },
});
