import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/useTheme';
import type { AppMode } from '@/lib/settings';

type IconName = keyof typeof Ionicons.glyphMap;

export interface ModeTab {
  name: string;
  label: string;
  icon: IconName;
  iconActive: IconName;
}

/** Bottom tabs per mode: two on the left, two on the right of the calendar button. */
export const MODE_TABS: Record<AppMode, ModeTab[]> = {
  college: [
    { name: 'classes', label: 'Classes', icon: 'school-outline', iconActive: 'school' },
    { name: 'exams', label: 'Exams', icon: 'document-text-outline', iconActive: 'document-text' },
    { name: 'attendance', label: 'Attendance', icon: 'checkmark-done-outline', iconActive: 'checkmark-done' },
    { name: 'tasks', label: 'Tasks', icon: 'list-outline', iconActive: 'list' },
  ],
  gamedev: [
    { name: 'projects', label: 'Projects', icon: 'game-controller-outline', iconActive: 'game-controller' },
    { name: 'focus', label: 'Focus', icon: 'timer-outline', iconActive: 'timer' },
    { name: 'devlog', label: 'Devlog', icon: 'journal-outline', iconActive: 'journal' },
    { name: 'ideas', label: 'Ideas', icon: 'bulb-outline', iconActive: 'bulb' },
  ],
};

export const CALENDAR_ROUTE = 'index';

export function BottomBar({ mode, current, onNavigate }: { mode: AppMode; current: string; onNavigate: (route: string) => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const tabs = MODE_TABS[mode];

  const tab = (t: ModeTab) => {
    const on = current === t.name;
    return (
      <Pressable
        key={t.name}
        onPress={() => onNavigate(t.name)}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        accessibilityLabel={t.label}
        style={styles.tab}
      >
        <Ionicons name={on ? t.iconActive : t.icon} size={22} color={on ? theme.primary : theme.muted} />
        <Text style={[styles.label, { color: on ? theme.primary : theme.muted }]} numberOfLines={1}>
          {t.label}
        </Text>
      </Pressable>
    );
  };

  const calOn = current === CALENDAR_ROUTE;
  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10), backgroundColor: theme.background }]}>
      <View style={[styles.bar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {tab(tabs[0])}
        {tab(tabs[1])}
        <Pressable
          onPress={() => onNavigate(CALENDAR_ROUTE)}
          accessibilityRole="tab"
          accessibilityState={{ selected: calOn }}
          accessibilityLabel="Calendar"
          style={[styles.center, { backgroundColor: theme.primary, borderColor: theme.background }]}
        >
          <Ionicons name={calOn ? 'calendar' : 'calendar-outline'} size={28} color={theme.onPrimary} />
        </Pressable>
        {tab(tabs[2])}
        {tab(tabs[3])}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 12, paddingTop: 6 },
  bar: { flexDirection: 'row', alignItems: 'center', borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 6, height: 64 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, height: '100%' },
  label: { fontSize: 11, fontWeight: '600' },
  center: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginTop: -26, borderWidth: 4, marginHorizontal: 4 },
});
