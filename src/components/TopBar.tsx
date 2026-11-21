import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/useTheme';
import { radius } from '@/theme/colors';
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
      <View style={[styles.switch, { backgroundColor: theme.raised }]} accessibilityRole="tablist">
        {MODES.map((m) => {
          const on = m.mode === mode;
          return (
            <Pressable
              key={m.mode}
              onPress={() => onChange(m.mode)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${m.label} mode`}
              style={[styles.segment, on && { backgroundColor: theme.text }]}
            >
              <Text style={[styles.segmentText, { color: on ? theme.background : theme.muted }]} numberOfLines={1}>
                {m.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        onPress={() => router.push('/settings')}
        accessibilityRole="button"
        accessibilityLabel="Settings and more"
        style={({ pressed }) => [styles.gear, { backgroundColor: pressed ? theme.border : theme.raised }]}
      >
        <Ionicons name="options-outline" size={21} color={theme.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 8 },
  switch: { flex: 1, flexDirection: 'row', borderRadius: radius.md, padding: 3 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radius.sm + 1 },
  segmentText: { fontWeight: '600', fontSize: 14, letterSpacing: 0.1 },
  gear: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
