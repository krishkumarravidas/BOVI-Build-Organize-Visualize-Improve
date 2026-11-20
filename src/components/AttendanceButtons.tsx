import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import type { AttendanceStatus } from '@/lib/college';

/** Present / Absent toggle; tapping the active one clears it. */
export function AttendanceButtons({
  value,
  onChange,
  label,
}: {
  value?: AttendanceStatus;
  onChange: (v: AttendanceStatus | null) => void;
  label: string;
}) {
  const theme = useTheme();
  const btn = (status: AttendanceStatus, text: string, color: string) => {
    const on = value === status;
    return (
      <Pressable
        onPress={() => onChange(on ? null : status)}
        accessibilityRole="radio"
        accessibilityState={{ selected: on }}
        accessibilityLabel={`${label}: ${text}`}
        style={[styles.btn, { borderColor: color, backgroundColor: on ? color : 'transparent' }]}
      >
        <Text style={{ color: on ? theme.background : color, fontWeight: '700' }}>{text}</Text>
      </Pressable>
    );
  };
  return (
    <View style={styles.row}>
      {btn('present', 'Present', theme.accent)}
      {btn('absent', 'Absent', theme.danger)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  btn: { borderWidth: 2, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
});
