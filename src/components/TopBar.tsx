import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/useTheme';
import type { AppMode } from '@/lib/settings';

/** COLLEGE | <your second tab name> switch with a settings button, shown above every tab. */
export function TopBar({ mode, onChange, projectsLabel }: { mode: AppMode; onChange: (m: AppMode) => void; projectsLabel: string }) {
  const theme = useTheme();
  const MODES: { mode: AppMode; label: string }[] = [
    { mode: 'college', label: 'College' },
    { mode: 'gamedev', label: projectsLabel },
  ];
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + 8, backgroundColor: theme.background }]}>
      <View style={[styles.switch, { backgroundColor: theme.surface, borderColor: theme.border }]} accessibilityRole="tablist">
        {MODES.map((m) => {
          const on = m.mode === mode;
          return (
            <Pressable
              key={m.mode}
              onPress={() => onChange(m.mode)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${m.label} mode`}
              style={[styles.segment, on && { backgroundColor: theme.primary }]}
            >
              <Text style={[styles.segmentText, { color: on ? theme.onPrimary : theme.muted }]}>{m.label.toUpperCase()}</Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        onPress={() => router.push('/settings')}
        accessibilityRole="button"
        accessibilityLabel="Settings and more"
        style={[styles.gear, { backgroundColor: theme.surface, borderColor: theme.border }]}
      >
        <Ionicons name="settings-outline" size={22} color={theme.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 8 },
  switch: { flex: 1, flexDirection: 'row', borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 4 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10 },
  segmentText: { fontWeight: '800', fontSize: 13, letterSpacing: 0.6 },
  gear: { width: 46, height: 46, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
});
