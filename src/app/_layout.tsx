import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AppLockGate } from '@/components/AppLockGate';
import { useAutoBackup } from '@/hooks/useAutoBackup';
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
  const { settings } = useSettings();
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
    <SettingsProvider>
      <HabitsProvider>
        <CollegeProvider>
          <ProjectsProvider>
            <AppShell />
          </ProjectsProvider>
        </CollegeProvider>
      </HabitsProvider>
    </SettingsProvider>
  );
}
