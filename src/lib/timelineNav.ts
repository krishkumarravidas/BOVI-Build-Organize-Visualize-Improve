import { router } from 'expo-router';

import type { TimelineItem } from './timeline';
import type { DateKey } from './types';

/** Where tapping a timeline item goes (habits and study sessions toggle, so callers handle them). */
export function timelinePress(item: TimelineItem, day: DateKey): (() => void) | undefined {
  switch (item.kind) {
    case 'block':
      return () => router.push({ pathname: '/schedule/[id]', params: { id: item.blockId } });
    case 'class':
      return () => router.push({ pathname: '/college/class', params: { date: day, key: item.occurrenceKey } });
    case 'exam':
      return () => router.push({ pathname: '/college/exam/[id]', params: { id: item.examId } });
    default:
      return undefined;
  }
}
