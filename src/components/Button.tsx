import { Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

interface Props {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'danger' | 'plain';
  disabled?: boolean;
}

export function Button({ title, onPress, variant = 'primary', disabled }: Props) {
  const theme = useTheme();
  const bg = variant === 'primary' ? theme.primary : 'transparent';
  const color = variant === 'primary' ? theme.onPrimary : variant === 'danger' ? theme.danger : theme.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
      ]}
    >
      <Text style={[styles.text, { color }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12, alignItems: 'center' },
  text: { fontSize: 16, fontWeight: '700' },
});
