import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Appearance, Platform } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { AppLockGate } from '@/components/AppLockGate';
import { useAutoBackup } from '@/hooks/useAutoBackup';
import { useClaudeSync } from '@/hooks/useClaudeSync';
import { CollegeProvider } from '@/hooks/useCollege';
import { HabitsProvider } from '@/hooks/useHabits';
import { ProjectsProvider } from '@/hooks/useProjects';
import { useReminderSync } from '@/hooks/useReminderSync';
import { useStudyTicker } from '@/hooks/useStudyTicker';
import { useWidgetSync } from '@/hooks/useWidgetSync';
import { SettingsProvider, useSettings } from '@/hooks/useSettings';

function AppShell() {
  useReminderSync();
  useWidgetSync();
  useStudyTicker();
  useAutoBackup({ auto: true });
  useClaudeSync();
  const { settings } = useSettings();
  // Native dialogs (clock/calendar pickers, alerts) follow BOVI's own light/dark choice, not just the phone's.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    Appearance.setColorScheme(settings.theme === 'system' ? 'unspecified' : settings.theme);
  }, [settings.theme]);
  return (
    <>
      <StatusBar style={settings.theme === 'system' ? 'auto' : settings.theme === 'dark' ? 'light' : 'dark'} />
      <AppLockGate>
        <Stack screenOptions={{ headerShown: false }} />
      </AppLockGate>
    </>
  );
}

export default function RootLayout() {
  return (
    <KeyboardProvider>
      <SettingsProvider>
        <HabitsProvider>
          <CollegeProvider>
            <ProjectsProvider>
              <AppShell />
            </ProjectsProvider>
          </CollegeProvider>
        </HabitsProvider>
      </SettingsProvider>
    </KeyboardProvider>
  );
}
