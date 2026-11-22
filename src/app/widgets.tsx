import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { KeyboardScroll, ScreenHeader } from '@/components/ui';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { canPinWidgets, pinWidget, placedWidgets, widgetAvailable, type WidgetKind } from '../../modules/bovi-widget';

const widgetList = (tab: string): { kind: WidgetKind; name: string; size: string; what: string }[] => [
  { kind: 'habits', name: 'Habits', size: '2×3', what: 'Tick off today’s habits right on the home screen.' },
  { kind: 'attendance', name: 'Attendance', size: '4×3', what: 'After a class starts it asks “Were you in Maths?” with a yes / no button, and shows how many classes you can skip per subject.' },
  { kind: 'gamedev', name: tab, size: '4×2', what: 'Your project’s next milestone, a focus timer you can start and stop, and a quick “+ Idea” button.' },
  { kind: 'today', name: 'Today', size: '4×3', what: 'All of today’s classes (cancelled ones struck through, changes tagged) and assignments due, with a tick.' },
  { kind: 'dial', name: 'Dial', size: '2×3', what: '12 hours on a clock face, like the calendar dial. ◀ ▶ turn it 3 hours at a time, through today and the next two days; tap the label for now.' },
  { kind: 'exam', name: 'Exam countdown', size: '2×2', what: 'Days to your next exam and how much of the syllabus you’ve revised.' },
  { kind: 'week', name: 'Week rings', size: '4×1', what: 'This week’s progress rings.' },
  { kind: 'screentime', name: 'Screen time', size: '3×2', what: 'Today’s total against your limit, plus your top apps.' },
  { kind: 'glance', name: 'Glance', size: '4×1', what: `One slim line: what’s on now or next (or your focus session in ${tab} mode).` },
  { kind: 'next', name: 'BOVI', size: '4×2', what: `Current or next class, next exam and habits. Follows your College / ${tab} switch.` },
];

/** Lists the home-screen widgets with a one-tap "Add to home screen" where the launcher supports it. */
export default function WidgetsScreen() {
  const theme = useTheme();
  const { settings } = useSettings();
  const WIDGETS = widgetList(settings.projectsTabName);
  const [placed, setPlaced] = useState<Partial<Record<WidgetKind, number>>>({});
  const [message, setMessage] = useState<string | null>(null);
  const pinnable = canPinWidgets();

  useFocusEffect(
    useCallback(() => {
      setPlaced(placedWidgets());
      // Re-check shortly after returning from the launcher's "Add widget" dialog.
      const t = setTimeout(() => setPlaced(placedWidgets()), 1500);
      return () => clearTimeout(t);
    }, []),
  );

  const add = (kind: WidgetKind) => {
    setMessage(pinWidget(kind) ? 'Confirm on the pop-up to place it.' : 'Long-press your home screen → Widgets → BOVI.');
  };

  return (
    <KeyboardScroll style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      <ScreenHeader title="Widgets" />
      {!widgetAvailable ? (
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={{ color: theme.muted }}>
            {Platform.OS === 'android'
              ? 'This build doesn’t include the widgets yet. Rebuild and reinstall the app to get them.'
              : 'Widgets are only available in the Android app.'}
          </Text>
        </View>
      ) : (
        <Text style={{ color: theme.muted }}>
          {pinnable
            ? 'Tap Add, then confirm on the pop-up. Or long-press your home screen → Widgets → BOVI.'
            : 'Long-press your home screen → Widgets → BOVI, then drag one onto the screen.'}{' '}
          Ticks and taps on widgets sync into the app the next time it opens.
        </Text>
      )}
      {message ? <Text style={{ color: theme.accent, fontWeight: '600' }}>{message}</Text> : null}
      {WIDGETS.map((w) => {
        const count = placed[w.kind] ?? 0;
        return (
          <View key={w.kind} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.row}>
              <Text style={[styles.name, { color: theme.text }]}>{w.name}</Text>
              <Text style={{ color: theme.muted, fontSize: 12 }}>{w.size}</Text>
              {count > 0 ? <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '600' }}>On home screen</Text> : null}
            </View>
            <Text style={{ color: theme.muted }}>{w.what}</Text>
            {widgetAvailable && pinnable ? <Button title={count > 0 ? 'Add another' : 'Add to home screen'} variant="plain" onPress={() => add(w.kind)} /> : null}
          </View>
        );
      })}
    </KeyboardScroll>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  name: { fontSize: 16, fontWeight: '700', flex: 1 },
});
