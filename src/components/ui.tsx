import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { readableOn } from '@/theme/contrast';

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
        headerTitleStyle: { color: theme.text },
        headerTintColor: theme.primary,
      }}
    />
  );
}

/** Scrollable, keyboard-aware form body. */
export function FormScreen({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={styles.form}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function Field({ label, hint, ...input }: TextInputProps & { label: string; hint?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      <TextInput
        placeholderTextColor={theme.muted}
        accessibilityLabel={label}
        {...input}
        style={[
          styles.input,
          input.multiline && styles.multiline,
          { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      />
      {hint ? <Text style={{ color: theme.muted, fontSize: 13 }}>{hint}</Text> : null}
    </View>
  );
}

/** Two time fields side by side. */
export function TimeRangeFields(props: {
  start: string;
  end: string;
  onStart: (v: string) => void;
  onEnd: (v: string) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Field label="Start" value={props.start} onChangeText={props.onStart} placeholder="HH:mm" keyboardType="numbers-and-punctuation" maxLength={5} />
      </View>
      <View style={{ flex: 1 }}>
        <Field label="End" value={props.end} onChangeText={props.onEnd} placeholder="HH:mm" keyboardType="numbers-and-punctuation" maxLength={5} />
      </View>
    </View>
  );
}

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
      style={[styles.chip, { borderColor: c, backgroundColor: selected ? c : 'transparent' }]}
    >
      <Text style={{ color: selected ? (color ? readableOn(color) : theme.onPrimary) : theme.text, fontWeight: '600' }} numberOfLines={1}>
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
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityHint={hint}
      style={({ pressed }) => [
        styles.listRow,
        { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <View style={[styles.bar, { backgroundColor: color || theme.primary }]} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.titleRow}>
          <Text
            style={[styles.rowTitle, { color: muted ? theme.muted : theme.text }, muted && styles.strike]}
            numberOfLines={2}
          >
            {title}
          </Text>
          {badge ? (
            <Text style={[styles.badge, { color: badgeColor, borderColor: badgeColor }]}>{badge.text}</Text>
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
  form: { padding: 16, gap: 18, paddingBottom: 40 },
  field: { gap: 8 },
  label: { fontSize: 15, fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 10 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, minHeight: 32 },
  section: { fontSize: 14, fontWeight: '700', textTransform: 'uppercase' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 2, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 7, maxWidth: '100%' },
  listRow: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  bar: { width: 4, borderRadius: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  rowTitle: { flex: 1, fontSize: 16, fontWeight: '600' },
  strike: { textDecorationLine: 'line-through' },
  badge: { fontSize: 12, fontWeight: '700', borderWidth: 1, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden' },
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
