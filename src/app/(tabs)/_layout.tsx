import { Tabs, useSegments } from 'expo-router';
import { useEffect } from 'react';

import { BottomBar, CALENDAR_ROUTE, MODE_TABS } from '@/components/BottomBar';
import { TopBar } from '@/components/TopBar';
import { useSettings } from '@/hooks/useSettings';
import { useSetupGate } from '@/hooks/useSetupGate';
import { useShareIntent } from '@/hooks/useShareIntent';
import type { AppMode } from '@/lib/settings';

export default function TabsLayout() {
  const { settings, update, ready } = useSettings();
  const mode = settings.mode;
  const segments = useSegments();
  const leaf = segments[segments.length - 1];
  useShareIntent();
  useSetupGate();

  // Deep links (widgets, app shortcuts) can land on the other mode's tab: switch the bars to match.
  useEffect(() => {
    if (!ready || !leaf) return;
    const owner = (Object.keys(MODE_TABS) as AppMode[]).find((m) => MODE_TABS[m].some((t) => t.name === leaf));
    if (owner && owner !== mode) update({ mode: owner });
  }, [leaf, mode, ready, update]);

  return (
    <Tabs
      tabBar={({ state, navigateToTab }) => {
        const current = state.routes[state.index]?.name ?? CALENDAR_ROUTE;
        const go = (name: string) => {
          const route = state.routes.find((r) => r.name === name);
          if (route) navigateToTab(route.key);
        };
        return <BottomBar mode={mode} current={current} onNavigate={go} />;
      }}
      screenOptions={({ navigation, route }) => ({
        header: () => (
          <TopBar
            mode={mode}
            projectsLabel={settings.projectsTabName}
            onChange={(next: AppMode) => {
              if (next === mode) return;
              update({ mode: next });
              // Stay in the same slot: e.g. Exams (college #2) → Focus (game dev #2). The calendar stays put.
              const slot = MODE_TABS[mode].findIndex((t) => t.name === route.name);
              if (slot >= 0) navigation.navigate(MODE_TABS[next][slot].name);
            }}
          />
        ),
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Calendar' }} />
      {[...MODE_TABS.college, ...MODE_TABS.gamedev].map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: t.label }} />
      ))}
    </Tabs>
  );
}
