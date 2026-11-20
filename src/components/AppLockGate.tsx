import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Image, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { appLockSupported, shouldRelock, unlock } from '@/lib/appLock';

/**
 * Covers the app with a lock screen when App lock is on: at launch, and after it has been in the
 * background for a minute. Unlocks with fingerprint/face or the phone's PIN.
 */
export function AppLockGate({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const { settings, ready } = useSettings();
  const enabled = ready && settings.appLock && appLockSupported;
  const [locked, setLocked] = useState(true);
  const [failed, setFailed] = useState(false);
  const backgroundedAt = useRef<number | null>(null);
  const prompting = useRef(false);
  const wasEnabled = useRef<boolean | null>(null);

  // Turning the lock on in Settings shouldn't lock you out on the spot; it applies from the next launch/background.
  useEffect(() => {
    if (!ready) return;
    if (wasEnabled.current === false && enabled) setLocked(false);
    wasEnabled.current = enabled;
  }, [enabled, ready]);

  const tryUnlock = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    const ok = await unlock();
    prompting.current = false;
    setFailed(!ok);
    if (ok) setLocked(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') backgroundedAt.current = Date.now();
      if (s === 'active') {
        if (shouldRelock(backgroundedAt.current, Date.now())) setLocked(true);
        backgroundedAt.current = null;
      }
    });
    return () => sub.remove();
  }, [enabled]);

  // Ask straight away whenever the lock screen appears.
  const showLock = enabled && locked;
  useEffect(() => {
    // Opens the system fingerprint/PIN prompt (an external system); state only changes after it resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (showLock) tryUnlock();
  }, [showLock, tryUnlock]);

  return (
    <>
      {children}
      {showLock ? (
        <View style={[StyleSheet.absoluteFill, styles.lock, { backgroundColor: theme.background }]} accessibilityViewIsModal>
          <Image source={require('../../assets/icon.png')} style={styles.icon} accessibilityIgnoresInvertColors />
          <Text style={[styles.title, { color: theme.text }]}>BOVI is locked</Text>
          {failed ? <Text style={{ color: theme.muted }}>Not unlocked. Try again.</Text> : null}
          <View style={{ alignSelf: 'stretch' }}>
            <Button title="Unlock" onPress={tryUnlock} />
          </View>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  lock: { alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32, zIndex: 1000 },
  icon: { width: 88, height: 88, borderRadius: 20 },
  title: { fontSize: 20, fontWeight: '800' },
});
