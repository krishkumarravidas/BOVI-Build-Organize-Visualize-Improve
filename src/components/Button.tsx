import { Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { radius } from '@/theme/colors';
import { mix } from '@/theme/contrast';

interface Props {
  title: string;
  onPress: () => void;
  /** primary = filled; plain = tonal (tinted, for secondary actions); danger = tonal red. */
  variant?: 'primary' | 'danger' | 'plain';
  disabled?: boolean;
}

export function Button({ title, onPress, variant = 'primary', disabled }: Props) {
  const theme = useTheme();
  const tone = variant === 'danger' ? theme.danger : theme.primary;
  const bg = variant === 'primary' ? theme.primary : mix(theme.surface, tone, 0.14);
  const color = variant === 'primary' ? theme.onPrimary : tone;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.button,
        variant !== 'primary' && styles.secondary,
        { backgroundColor: bg, opacity: disabled ? 0.45 : 1, transform: [{ scale: pressed && !disabled ? 0.98 : 1 }] },
      ]}
    >
      <Text style={[styles.text, variant !== 'primary' && styles.secondaryText, { color }]} numberOfLines={1}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 50, paddingHorizontal: 20, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  secondary: { minHeight: 44, paddingHorizontal: 16 },
  text: { fontSize: 16, fontWeight: '600', letterSpacing: 0.1 },
  secondaryText: { fontSize: 15 },
});
