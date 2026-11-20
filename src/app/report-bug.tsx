import { Redirect, type Href } from 'expo-router';
import { Text, View } from 'react-native';

import { useProjects } from '@/hooks/useProjects';
import { useTheme } from '@/hooks/useTheme';

/** Target of the "Report bug" app-icon shortcut: opens a new bug on the active project. */
export default function ReportBugRoute() {
  const theme = useTheme();
  const p = useProjects();
  if (!p.ready) return <View style={{ flex: 1, backgroundColor: theme.background }} />;
  const project = p.projects.find((x) => x.status === 'active') ?? p.projects.find((x) => x.status !== 'done' && x.status !== 'parked');
  if (!project) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, padding: 16 }}>
        <Text style={{ color: theme.muted }}>Add a project first, then report bugs on it.</Text>
      </View>
    );
  }
  return <Redirect href={{ pathname: '/gamedev/bug', params: { id: project.id, bug: 'new' } } as unknown as Href} />;
}
