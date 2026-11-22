import { Stack } from 'expo-router';
import { useState, type ReactNode } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAwareScrollView, type KeyboardAwareScrollViewProps } from 'react-native-keyboard-controller';

import { radius } from '@/theme/colors';
import { mix, readableOn } from '@/theme/contrast';

/** Stack header themed like the rest of the app. */
export function ScreenHeader({ title, modal }: { title: string; modal?: boolean }) {
  const theme = useTheme();
  return (
    <Stack.Screen
      options={{
        headerShown: true,
        title,
        presentation: modal ? 'modal' : 'card',
        headerStyle: { backgroundColor: theme.background },
        headerTitleStyle: { color: theme.text, fontWeight: '700' },
        headerTintColor: theme.text,
        headerShadowVisible: false,
      }}
    />
  );
}

/**
 * ScrollView that keeps the focused text field above the keyboard. Android draws edge-to-edge, so the
 * window no longer resizes for the keyboard; this scrolls the field into view instead (Android and iOS).
 */
export function KeyboardScroll({ bottomOffset = 32, keyboardShouldPersistTaps = 'handled', ...props }: KeyboardAwareScrollViewProps) {
  return <KeyboardAwareScrollView bottomOffset={bottomOffset} keyboardShouldPersistTaps={keyboardShouldPersistTaps} {...props} />;
}

/** Scrollable, keyboard-aware form body. */
export function FormScreen({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <KeyboardScroll style={{ flex: 1, backgroundColor: theme.background }} contentContainerStyle={styles.form}>
      {children}
    </KeyboardScroll>
  );
}

export function Field({ label, hint, ...input }: TextInputProps & { label: string; hint?: string }) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.muted }]}>{label}</Text>
      <TextInput
        placeholderTextColor={theme.muted}
        accessibilityLabel={label}
        {...input}
        onFocus={(e) => {
          setFocused(true);
          input.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          input.onBlur?.(e);
        }}
        style={[
          styles.input,
          input.multiline && styles.multiline,
          { color: theme.text, backgroundColor: theme.raised, borderColor: focused ? theme.primary : 'transparent' },
        ]}
      />
      {hint ? <Text style={{ color: theme.muted, fontSize: 13 }}>{hint}</Text> : null}
    </View>
  );
}

export { DateField, TimeField, TimeRangeFields } from './pickers';

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const theme = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }, style]}>{children}</View>;
}

export function SectionTitle({ children, right }: { children: string; right?: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.sectionRow}>
      <Text style={[styles.section, { color: theme.muted }]}>{children}</Text>
      {right}
    </View>
  );
}

export function Chip({ label, selected, onPress, color }: { label: string; selected: boolean; onPress: () => void; color?: string }) {
  const theme = useTheme();
  const c = color || theme.primary;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.chip, { backgroundColor: selected ? c : theme.raised, opacity: pressed ? 0.85 : 1 }]}
    >
      {color && !selected ? <View style={[styles.chipDot, { backgroundColor: color }]} /> : null}
      <Text style={[styles.chipText, { color: selected ? (color ? readableOn(color) : theme.onPrimary) : theme.text }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={styles.chips}>{children}</View>;
}

/** Tappable list row with a colour bar. */
export function ListRow({
  title,
  subtitle,
  detail,
  color,
  onPress,
  badge,
  muted,
  hint,
}: {
  title: string;
  subtitle?: string;
  detail?: string;
  color?: string;
  onPress?: () => void;
  badge?: { text: string; tone: 'danger' | 'accent' | 'muted' };
  muted?: boolean;
  hint?: string;
}) {
  const theme = useTheme();
  const badgeColor = badge?.tone === 'danger' ? theme.danger : badge?.tone === 'accent' ? theme.accent : theme.muted;
  const dot = color || theme.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityHint={hint}
      style={({ pressed }) => [
        styles.listRow,
        { backgroundColor: pressed ? theme.raised : theme.surface, borderColor: theme.border },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.titleRow}>
          <Text
            style={[styles.rowTitle, { color: muted ? theme.muted : theme.text }, muted && styles.strike]}
            numberOfLines={2}
          >
            {title}
          </Text>
          {badge ? (
            <Text style={[styles.badge, { color: badgeColor, backgroundColor: mix(theme.surface, badgeColor, 0.15) }]}>{badge.text}</Text>
          ) : null}
        </View>
        {subtitle ? (
          <Text style={{ color: theme.muted }} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
        {detail ? (
          <Text style={{ color: theme.muted, fontSize: 13 }} numberOfLines={3}>
            {detail}
          </Text>
        ) : null}
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={18} color={theme.muted} style={styles.chevron} /> : null}
    </Pressable>
  );
}

export function ErrorText({ children }: { children?: string | null }) {
  const theme = useTheme();
  return children ? <Text style={{ color: theme.danger }}>{children}</Text> : null;
}

export function EmptyText({ children }: { children: string }) {
  const theme = useTheme();
  return <Text style={{ color: theme.muted }}>{children}</Text>;
}

const styles = StyleSheet.create({
  form: { padding: 20, gap: 18, paddingBottom: 48 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', letterSpacing: 0.2 },
  input: { borderWidth: 1.5, borderRadius: radius.sm + 2, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 10 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, minHeight: 28 },
  section: { fontSize: 12, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 8, maxWidth: '100%' },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontSize: 14, fontWeight: '600' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 14, borderRadius: radius.md + 2, borderWidth: StyleSheet.hairlineWidth },
  dot: { width: 10, height: 10, borderRadius: 5, alignSelf: 'flex-start', marginTop: 6 },
  chevron: { marginLeft: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  rowTitle: { flex: 1, fontSize: 16, fontWeight: '600' },
  strike: { textDecorationLine: 'line-through' },
  badge: { fontSize: 12, fontWeight: '700', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
});

/** Destructive confirmation (native alert; web confirms immediately, as Alert buttons don't work there). */
export function confirmDestructive(title: string, message: string, action: string, onConfirm: () => void) {
  if (Platform.OS === 'web') return onConfirm();
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: action, style: 'destructive', onPress: onConfirm },
  ]);
}

/** "Mon 16 Nov" */
export function shortDate(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}
