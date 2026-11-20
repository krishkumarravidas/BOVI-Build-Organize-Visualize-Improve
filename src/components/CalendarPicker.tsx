import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import {
  calendarSupported,
  getCalendarAccess,
  listDeviceCalendars,
  requestCalendarAccess,
  type CalendarAccess,
  type CalendarInfo,
} from '@/lib/calendar';

/** Choose which device calendars appear in the Agenda. Stores `null` when all are selected. */
export function CalendarPicker() {
  const theme = useTheme();
  const { settings, update } = useSettings();
  const [access, setAccess] = useState<CalendarAccess | 'loading'>('loading');
  const [calendars, setCalendars] = useState<CalendarInfo[]>([]);

  const load = useCallback(async (request = false) => {
    if (!calendarSupported) return;
    try {
      const a = request ? await requestCalendarAccess() : await getCalendarAccess();
      setAccess(a);
      setCalendars(a === 'granted' ? await listDeviceCalendars() : []);
    } catch {
      setAccess('ask');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!calendarSupported) {
    return <Text style={{ color: theme.muted }}>Calendars are only available in the mobile app.</Text>;
  }
  if (access === 'loading') return null;
  if (access === 'ask') return <Button title="Allow calendar access" variant="plain" onPress={() => load(true)} />;
  if (access === 'blocked') {
    return <Text style={{ color: theme.danger }}>Calendar access is off. Enable it in system settings.</Text>;
  }
  if (calendars.length === 0) return <Text style={{ color: theme.muted }}>No calendars found on this phone.</Text>;

  const isOn = (id: string) => settings.calendarIds === null || settings.calendarIds.includes(id);
  const toggle = (id: string, on: boolean) => {
    const current = calendars.map((c) => c.id).filter(isOn);
    const next = on ? [...current, id] : current.filter((x) => x !== id);
    update({ calendarIds: next.length === calendars.length ? null : next });
  };

  return (
    <View style={styles.list}>
      {calendars.map((c) => (
        <View key={c.id} style={styles.row}>
          <View style={[styles.dot, { backgroundColor: c.color || theme.primary }]} />
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
            {c.title}
          </Text>
          <Switch
            value={isOn(c.id)}
            onValueChange={(on) => toggle(c.id, on)}
            accessibilityLabel={`Show ${c.title}`}
            trackColor={{ true: theme.primary }}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  name: { flex: 1, fontSize: 16 },
});
