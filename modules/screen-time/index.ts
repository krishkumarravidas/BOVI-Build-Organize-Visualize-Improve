import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

export interface AppUsage {
  packageName: string;
  label: string;
  foregroundMs: number;
}

interface ScreenTimeNative {
  hasUsageAccess(): boolean;
  openUsageAccessSettings(): void;
  getAppUsage(startMs: number, endMs: number): Promise<AppUsage[]>;
}

// Optional so web, tests and builds without the native code don't crash.
const native = Platform.OS === 'android' ? requireOptionalNativeModule<ScreenTimeNative>('ScreenTime') : null;

/** True when the native module is present (Android dev/release builds that include it). */
export const screenTimeAvailable = native != null;

export function hasUsageAccess(): boolean {
  return native?.hasUsageAccess() ?? false;
}

export function openUsageAccessSettings(): void {
  native?.openUsageAccessSettings();
}

/** Per-app foreground time in [start, end). Empty when unavailable. */
export async function getAppUsage(start: Date, end: Date): Promise<AppUsage[]> {
  if (!native) return [];
  return native.getAppUsage(start.getTime(), end.getTime());
}
