import { Ionicons } from '@expo/vector-icons';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, Text, TextInput, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { dateKeyAsDate, formatDateKey, formatTime, timeAsDate, toDateKey, toHHMM, uses12HourClock } from '@/lib/timeFormat';
import { radius } from '@/theme/colors';

/**
 * Time and date fields that open Android's Material clock / calendar dialogs instead of a keyboard.
 * Values stay in the app's stored formats (`HH:mm`, `YYYY-MM-DD`). Elsewhere (web), they fall back to
 * a plain text field so the same screens keep working.
 */

const NATIVE = Platform.OS === 'android';

interface Common {
  /** Shown above the field and as the dialog title. Omit for a compact, label-less field. */
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  /** Shows a clear (×) button when set, for optional values. */
  optional?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

export function TimeField({ fallback = '09:00', ...props }: Common & { fallback?: string }) {
  const h12 = uses12HourClock();
  return (
    <PickerField
      {...props}
      icon="time-outline"
      display={props.value ? formatTime(props.value, h12) : ''}
      webPlaceholder="HH:mm"
      open={() =>
        DateTimePickerAndroid.open({
          mode: 'time',
          design: 'material',
          value: timeAsDate(props.value, fallback),
          is24Hour: !h12,
          title: props.label ?? props.accessibilityLabel,
          onChange: (event, date) => {
            if (event.type === 'set' && date) props.onChange(toHHMM(date));
          },
        })
      }
    />
  );
}

export function DateField({ minimumDate, ...props }: Common & { minimumDate?: Date }) {
  return (
    <PickerField
      {...props}
      icon="calendar-outline"
      display={props.value ? formatDateKey(props.value) : ''}
      webPlaceholder="YYYY-MM-DD"
      open={() =>
        DateTimePickerAndroid.open({
          mode: 'date',
          design: 'material',
          value: dateKeyAsDate(props.value),
          minimumDate,
          title: props.label ?? props.accessibilityLabel,
          onChange: (event, date) => {
            if (event.type === 'set' && date) props.onChange(toDateKey(date));
          },
        })
      }
    />
  );
}

/** Start and end times side by side. */
export function TimeRangeFields(props: { start: string; end: string; onStart: (v: string) => void; onEnd: (v: string) => void }) {
  return (
    <View style={styles.row}>
      <TimeField label="Start" value={props.start} onChange={props.onStart} style={{ flex: 1 }} />
      <TimeField label="End" value={props.end} onChange={props.onEnd} fallback={props.start || '10:00'} style={{ flex: 1 }} />
    </View>
  );
}

function PickerField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  optional,
  style,
  accessibilityLabel,
  icon,
  display,
  webPlaceholder,
  open,
}: Common & { icon: keyof typeof Ionicons.glyphMap; display: string; webPlaceholder: string; open: () => void }) {
  const theme = useTheme();
  const name = label ?? accessibilityLabel ?? placeholder ?? 'Pick';
  return (
    <View style={[styles.field, style]}>
      {label ? <Text style={[styles.label, { color: theme.muted }]}>{label}</Text> : null}
      {NATIVE ? (
        <Pressable
          onPress={open}
          accessibilityRole="button"
          accessibilityLabel={`${name}: ${display || 'not set'}`}
          style={({ pressed }) => [styles.box, { backgroundColor: theme.raised, opacity: pressed ? 0.75 : 1 }]}
        >
          <Ionicons name={icon} size={18} color={theme.muted} />
          <Text numberOfLines={1} style={[styles.value, { color: display ? theme.text : theme.muted }]}>
            {display || placeholder || 'Tap to pick'}
          </Text>
          {optional && value ? (
            <Pressable onPress={() => onChange('')} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Clear ${name}`}>
              <Ionicons name="close-circle" size={18} color={theme.muted} />
            </Pressable>
          ) : null}
        </Pressable>
      ) : (
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder ?? webPlaceholder}
          placeholderTextColor={theme.muted}
          autoCapitalize="none"
          accessibilityLabel={name}
          style={[styles.box, styles.value, { color: theme.text, backgroundColor: theme.raised }]}
        />
      )}
      {hint ? <Text style={{ color: theme.muted, fontSize: 13 }}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  row: { flexDirection: 'row', gap: 12 },
  label: { fontSize: 13, fontWeight: '600', letterSpacing: 0.2 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 50,
    borderRadius: radius.sm + 2,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  value: { flex: 1, fontSize: 16 },
});
