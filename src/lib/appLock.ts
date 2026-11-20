import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

/** Re-lock after the app has been in the background this long. */
export const RELOCK_AFTER_MS = 60_000;

export const appLockSupported = Platform.OS === 'android' || Platform.OS === 'ios';

/** Whether the phone has any lock (fingerprint, face or PIN/pattern) BOVI can ask for. */
export async function canUseAppLock(): Promise<boolean> {
  if (!appLockSupported) return false;
  try {
    return (await LocalAuthentication.getEnrolledLevelAsync()) !== LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return false;
  }
}

/** Fingerprint/face, falling back to the phone's PIN or pattern. */
export async function unlock(): Promise<boolean> {
  try {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock BOVI', cancelLabel: 'Cancel' });
    return r.success;
  } catch {
    return false;
  }
}

export function shouldRelock(backgroundedAt: number | null, now: number): boolean {
  return backgroundedAt !== null && now - backgroundedAt >= RELOCK_AFTER_MS;
}
