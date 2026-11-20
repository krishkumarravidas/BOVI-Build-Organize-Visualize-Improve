import { router } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { parseShare, setPendingShare } from '@/lib/share';
import { onShare, shareIntentAvailable, takeShared } from '../../modules/share-intent';

/**
 * Opens the "Save to BOVI" sheet when something is shared to the app — on a cold start, while it's
 * running (onShare), or when it comes back to the foreground. Mounted inside the navigator.
 */
export function useShareIntent() {
  useEffect(() => {
    if (!shareIntentAvailable) return;
    let busy = false;
    const check = async () => {
      if (busy) return;
      busy = true;
      try {
        const shared = await takeShared();
        if (!shared || (!shared.text && !shared.images.length)) return;
        setPendingShare(parseShare(shared));
        router.push('/share');
      } finally {
        busy = false;
      }
    };
    check();
    const off = onShare(check);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check());
    return () => {
      off();
      sub.remove();
    };
  }, []);
}
