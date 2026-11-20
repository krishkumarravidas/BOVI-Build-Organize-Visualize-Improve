import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { loadCommitCache, type CommitCache } from '@/lib/github';

/** Commits fetched earlier (kept on the phone), reloaded whenever the screen gains focus. */
export function useCommitCache(): [CommitCache, (c: CommitCache) => void] {
  const [cache, setCache] = useState<CommitCache>({});
  useFocusEffect(
    useCallback(() => {
      let live = true;
      loadCommitCache().then((c) => live && setCache(c));
      return () => {
        live = false;
      };
    }, []),
  );
  return [cache, setCache];
}
