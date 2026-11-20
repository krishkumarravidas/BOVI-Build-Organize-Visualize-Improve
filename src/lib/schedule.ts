import { addDays, fromDateKey, weekdayOf } from './dates';
import { parseReminderTime } from './reminders';
import type { DateKey, ScheduleBlock, Weekday } from './types';

export interface NewBlockInput {
  title: string;
  days: Weekday[];
  start: string;
  end: string;
  remind?: boolean;
}

const minutesOf = (hhmm: string) => {
  const t = parseReminderTime(hhmm);
  return t ? t.hour * 60 + t.minute : null;
};

/** Returns a user-facing error, or null when the input is valid. */
export function validateBlock(input: NewBlockInput): string | null {
  if (!input.title.trim()) return 'Enter a title';
  if (input.days.length === 0) return 'Pick at least one day';
  const start = minutesOf(input.start);
  const end = minutesOf(input.end);
  if (start === null || end === null) return 'Use 24h times, e.g. 09:00';
  if (start === end) return 'Start and end must differ';
  return null;
}

export function createBlock(input: NewBlockInput, id: string): ScheduleBlock {
  const error = validateBlock(input);
  if (error) throw new Error(error);
  return {
    id,
    title: input.title.trim(),
    days: [...new Set(input.days)].sort((a, b) => a - b) as Weekday[],
    start: input.start,
    end: input.end,
    remind: !!input.remind,
  };
}

export const isOvernight = (b: Pick<ScheduleBlock, 'start' | 'end'>) =>
  (minutesOf(b.end) ?? 0) < (minutesOf(b.start) ?? 0);

/** Local Date for `day` at `HH:mm`. */
function at(day: DateKey, hhmm: string): Date {
  const d = fromDateKey(day);
  const t = parseReminderTime(hhmm);
  if (t) d.setHours(t.hour, t.minute, 0, 0);
  return d;
}

export interface BlockOccurrence {
  block: ScheduleBlock;
  start: Date;
  end: Date;
}

/**
 * Occurrences touching `day`: blocks starting that day, plus overnight blocks
 * that started the previous day and spill into this morning.
 */
export function blockOccurrences(blocks: readonly ScheduleBlock[], day: DateKey): BlockOccurrence[] {
  const prev = addDays(day, -1);
  const out: BlockOccurrence[] = [];
  for (const block of blocks) {
    const overnight = isOvernight(block);
    if (block.days.includes(weekdayOf(day))) {
      out.push({ block, start: at(day, block.start), end: at(overnight ? addDays(day, 1) : day, block.end) });
    }
    if (overnight && block.days.includes(weekdayOf(prev))) {
      out.push({ block, start: at(prev, block.start), end: at(day, block.end) });
    }
  }
  return out;
}

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Every day", "Weekdays", "Weekends" or e.g. "Mon, Wed". Expects sorted days. */
export function describeDays(days: readonly Weekday[]): string {
  if (days.length === 7) return 'Every day';
  const key = days.join(',');
  if (key === '1,2,3,4,5') return 'Weekdays';
  if (key === '0,6') return 'Weekends';
  return days.map((d) => SHORT_DAYS[d]).join(', ');
}
