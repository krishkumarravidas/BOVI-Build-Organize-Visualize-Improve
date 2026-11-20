import { useEffect } from 'react';

import { useCollege } from '@/hooks/useCollege';
import { useProjects } from '@/hooks/useProjects';
import { toDateKey } from '@/lib/dates';
import { tickStudyForFocus } from '@/lib/study';

/**
 * When a study session is saved (even one that finished while the app was closed), ticks off that day's
 * planned revision session for the subject, once per session.
 */
export function useStudyTicker() {
  const { ready: collegeReady, apply: applyCollege } = useCollege();
  const { state, ready: projectsReady, apply: applyProjects } = useProjects();

  useEffect(() => {
    if (!collegeReady || !projectsReady) return;
    const pending = state.focus.filter((f) => f.subjectId && !f.counted);
    if (!pending.length) return;
    applyCollege((c) => pending.reduce((acc, f) => tickStudyForFocus(acc, f.subjectId!, toDateKey(new Date(f.start)), f.minutes), c));
    const ids = new Set(pending.map((f) => f.id));
    applyProjects((s) => ({ ...s, focus: s.focus.map((f) => (ids.has(f.id) ? { ...f, counted: true } : f)) }));
  }, [state.focus, collegeReady, projectsReady, applyCollege, applyProjects]);
}
