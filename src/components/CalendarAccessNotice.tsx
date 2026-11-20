import { Linking, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { useTheme } from '@/hooks/useTheme';
import { calendarSupported, type CalendarAccess } from '@/lib/calendar';

interface Props {
  access: CalendarAccess | 'loading';
  onRequest: () => void;
}

/** Non-blocking prompt shown above schedules when calendar events can't be read yet. */
export function CalendarAccessNotice({ access, onRequest }: Props) {
  const theme = useTheme();
  if (access === 'granted' || access === 'loading') return null;
  const card = [styles.card, { backgroundColor: theme.surface, borderColor: theme.border }];

  if (!calendarSupported) {
    return (
      <View style={card}>
        <Text style={{ color: theme.muted }}>Calendar events appear in the mobile app. Your schedule still shows here.</Text>
      </View>
    );
  }
  if (access === 'ask') {
    return (
      <View style={card}>
        <Text style={{ color: theme.muted }}>
          Show events from this phone&apos;s calendars (including Google Calendar). Nothing leaves your device.
        </Text>
        <Button title="Allow calendar access" variant="plain" onPress={onRequest} />
      </View>
    );
  }
  return (
    <View style={card}>
      <Text style={{ color: theme.danger }}>Calendar access is off. Enable it for BOVI in system settings.</Text>
      <Button title="Open settings" variant="plain" onPress={() => Linking.openSettings()} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 6 },
});
