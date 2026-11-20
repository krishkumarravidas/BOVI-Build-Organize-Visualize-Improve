import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { CalendarPicker } from '@/components/CalendarPicker';
import { ListRow, ScreenHeader } from '@/components/ui';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { appLockSupported, canUseAppLock, unlock } from '@/lib/appLock';
import { ensurePermission, hasPermission, remindersSupported } from '@/lib/notifications';
import { MAX_TAB_NAME, cleanTabName, type ThemePreference } from '@/lib/settings';

const BRIEFING_TIMES: { label: string; value: string | null }[] = [
  { label: 'Off', value: null },
  { label: '6:30', value: '06:30' },
  { label: '7:00', value: '07:00' },
  { label: '7:30', value: '07:30' },
  { label: '8:00', value: '08:00' },
  { label: '9:00', value: '09:00' },
];

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export default function SettingsScreen() {
  const theme = useTheme();
  const { settings, update } = useSettings();
  const [blocked, setBlocked] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);
  const [tabName, setTabName] = useState(settings.projectsTabName);

  // Surface a previously denied permission so the toggle doesn't silently do nothing.
  useEffect(() => {
    if (!remindersSupported || !settings.remindersEnabled) return;
    hasPermission().then((granted) => setBlocked(!granted));
  }, [settings.remindersEnabled]);

  const toggleReminders = async (next: boolean) => {
    if (!next) {
      setBlocked(false);
      update({ remindersEnabled: false });
      return;
    }
    const granted = await ensurePermission();
    setBlocked(!granted);
    update({ remindersEnabled: granted });
  };

  const toggleLock = async (next: boolean) => {
    setLockError(null);
    if (!next) {
      // Turning it off needs the same proof as unlocking.
      if (await unlock()) update({ appLock: false });
      return;
    }
    if (!(await canUseAppLock())) return setLockError('Set up a fingerprint or a screen lock (PIN/pattern) on your phone first.');
    if (await unlock()) update({ appLock: true });
    else setLockError('Not confirmed, so App lock stays off.');
  };

  const card = [styles.card, { backgroundColor: theme.surface, borderColor: theme.border }];

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingTop: 16 }]}
    >
      <ScreenHeader title="Settings" />

      <ListRow title="Habits" subtitle="Manage habits, streaks and history" onPress={() => router.push('/habits')} />
      <ListRow title="Schedule blocks" subtitle="Recurring time like gym, sleep, study" color={theme.accent} onPress={() => router.push('/schedule')} />
      <ListRow title="Screen time" subtitle="Today's usage, top apps and daily limit" onPress={() => router.push('/screen-time')} />
      <ListRow title="Widgets" subtitle="Home-screen widgets: habits, attendance, focus timer, dial…" color={theme.accent} onPress={() => router.push('/widgets')} />
      <ListRow title="Weekly review" subtitle="How the week went, then plan the next" color={theme.primary} onPress={() => router.push('/review')} />
      <ListRow title="Monthly report" subtitle="A shareable summary of the month" color={theme.primary} onPress={() => router.push('/report')} />
      <ListRow title="Insights" subtitle="Your week: habits, focus, attendance, screen time" onPress={() => router.push('/insights')} />
      <ListRow title="Run setup again" subtitle="College, subjects, attendance import, tab name, reminders" color={theme.muted} onPress={() => router.push('/setup')} />
      <ListRow title="Backup & restore" subtitle="Export everything, or restore from a backup" color={theme.muted} onPress={() => router.push('/backup')} />

      <Text style={[styles.section, { color: theme.muted }]}>Second tab</Text>
      <View style={card}>
        <Text style={{ color: theme.muted }}>What the tab next to College is called (projects, focus timer, devlog, ideas).</Text>
        <TextInput
          value={tabName}
          onChangeText={setTabName}
          onBlur={() => update({ projectsTabName: cleanTabName(tabName) })}
          onSubmitEditing={() => update({ projectsTabName: cleanTabName(tabName) })}
          maxLength={MAX_TAB_NAME}
          placeholder="Projects"
          placeholderTextColor={theme.muted}
          accessibilityLabel="Second tab name"
          style={[styles.input, { color: theme.text, borderColor: theme.border }]}
        />
        <View style={styles.chipRow}>
          {['Projects', 'Game dev', 'Side projects', 'Work'].map((t) => (
            <Pressable
              key={t}
              onPress={() => {
                setTabName(t);
                update({ projectsTabName: t });
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: settings.projectsTabName === t }}
              style={[styles.timeChip, { borderColor: theme.primary, backgroundColor: settings.projectsTabName === t ? theme.primary : 'transparent' }]}
            >
              <Text style={{ color: settings.projectsTabName === t ? theme.onPrimary : theme.text, fontWeight: '600' }}>{t}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Text style={[styles.section, { color: theme.muted }]}>Appearance</Text>
      <View style={card}>
        <View style={styles.segments}>
          {THEMES.map((t) => {
            const on = settings.theme === t.value;
            return (
              <Pressable
                key={t.value}
                onPress={() => update({ theme: t.value })}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={[styles.segment, { backgroundColor: on ? theme.primary : 'transparent' }]}
              >
                <Text style={{ color: on ? theme.onPrimary : theme.text, fontWeight: '600' }}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Text style={[styles.section, { color: theme.muted }]}>Calendars in Agenda</Text>
      <View style={card}>
        <CalendarPicker />
      </View>

      <Text style={[styles.section, { color: theme.muted }]}>Reminders</Text>
      <View style={card}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={[styles.label, { color: theme.text }]}>Habit reminders</Text>
            <Text style={{ color: theme.muted }}>
              {remindersSupported
                ? 'Notify me at each habit’s reminder time.'
                : 'Reminders are only available in the mobile app.'}
            </Text>
          </View>
          <Switch
            value={settings.remindersEnabled && remindersSupported}
            onValueChange={toggleReminders}
            disabled={!remindersSupported}
            accessibilityLabel="Habit reminders"
            trackColor={{ true: theme.primary }}
          />
        </View>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={[styles.label, { color: theme.text }]}>Exam reminders</Text>
            <Text style={{ color: theme.muted }}>8 PM the evening before, and 1 hour before each exam.</Text>
          </View>
          <Switch
            value={settings.examReminders && settings.remindersEnabled && remindersSupported}
            onValueChange={(v) => update({ examReminders: v })}
            disabled={!remindersSupported || !settings.remindersEnabled}
            accessibilityLabel="Exam reminders"
            trackColor={{ true: theme.primary }}
          />
        </View>
        <View style={{ gap: 8 }}>
          <Text style={[styles.label, { color: theme.text }]}>Morning briefing</Text>
          <Text style={{ color: theme.muted }}>One notification with today’s classes, exams, deadlines, habits and this week’s project tasks.</Text>
          <View style={styles.chipRow}>
            {BRIEFING_TIMES.map((t) => {
              const on = settings.briefingTime === t.value;
              return (
                <Pressable
                  key={t.label}
                  onPress={() => update({ briefingTime: t.value })}
                  disabled={!remindersSupported || !settings.remindersEnabled}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`Morning briefing ${t.label}`}
                  style={[styles.timeChip, { borderColor: theme.primary, backgroundColor: on ? theme.primary : 'transparent' }]}
                >
                  <Text style={{ color: on ? theme.onPrimary : theme.text, fontWeight: '600' }}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        {blocked ? (
          <Text style={{ color: theme.danger }}>
            Notifications are blocked. Enable them for this app in your device settings, then turn reminders on again.
          </Text>
        ) : null}
      </View>

      {appLockSupported ? (
        <>
          <Text style={[styles.section, { color: theme.muted }]}>Privacy</Text>
          <View style={card}>
            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={[styles.label, { color: theme.text }]}>App lock</Text>
                <Text style={{ color: theme.muted }}>Ask for your fingerprint (or the phone’s PIN) when opening BOVI, and after a minute away.</Text>
              </View>
              <Switch value={settings.appLock} onValueChange={toggleLock} accessibilityLabel="App lock" trackColor={{ true: theme.primary }} />
            </View>
            {lockError ? <Text style={{ color: theme.danger }}>{lockError}</Text> : null}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 10 },
  title: { fontSize: 34, fontWeight: '800', marginBottom: 6 },
  section: { fontSize: 14, fontWeight: '600', textTransform: 'uppercase', marginTop: 10 },
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 10 },
  segments: { flexDirection: 'row', gap: 6 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { flex: 1, gap: 2 },
  label: { fontSize: 17, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  timeChip: { borderWidth: 2, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
});
