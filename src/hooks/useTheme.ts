import { useColorScheme } from 'react-native';

import { useSettings } from '@/hooks/useSettings';
import { palette, type Theme } from '@/theme/colors';

export function useTheme(): Theme {
  const system = useColorScheme();
  const { settings } = useSettings();
  const scheme = settings.theme === 'system' ? system : settings.theme;
  return scheme === 'dark' ? palette.dark : palette.light;
}
