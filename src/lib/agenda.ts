import { addDays, fromDateKey } from './dates';
import type { DateKey } from './types';

export interface AgendaEvent {
  id: string;
  calendarId: string;
  title: string;
  location?: string;
  /** Local start time. For all-day events: local midnight of the first day. */
  start: Date;
  /** Exclusive end. For all-day events: local midnight after the last day. */
  end: Date;
  allDay: boolean;
}

export interface RawCalendarEvent {
  id: string;
  calendarId: string;
  title?: string | null;
  location?: string | null;
  startDate: string | Date;
  endDate: string | Date;
  allDay?: boolean | null;
}

/**
 * Converts a device-calendar event to our shape.
 * Android stores all-day events as UTC midnights, so reading them as local times would put them on the
 * wrong day west of UTC; for those we rebuild local midnight from the UTC date parts instead.
 */
export function toAgendaEvent(raw: RawCalendarEvent): AgendaEvent {
  const start = new Date(raw.startDate);
  const end = new Date(raw.endDate);
  const allDay = !!raw.allDay;
  const localMidnight = (d: Date) => new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return {
    id: raw.id,
    calendarId: raw.calendarId,
    title: raw.title?.trim() || '(No title)',
    location: raw.location?.trim() || undefined,
    start: allDay ? localMidnight(start) : start,
    end: allDay ? localMidnight(end) : end,
    allDay,
  };
}

export interface DaySection {
  day: DateKey;
  events: AgendaEvent[];
}

/** Does the event touch the local day starting at `dayStart`? (end is exclusive; instant events count by start.) */
function overlapsDay(event: AgendaEvent, dayStart: Date, dayEnd: Date): boolean {
  if (event.end <= event.start) return event.start >= dayStart && event.start < dayEnd;
  return event.start < dayEnd && event.end > dayStart;
}

/** Groups events into `numDays` consecutive day sections; multi-day events appear on every day they cover. */
export function groupByDay(events: readonly AgendaEvent[], firstDay: DateKey, numDays: number): DaySection[] {
  return Array.from({ length: numDays }, (_, i) => {
    const day = addDays(firstDay, i);
    const dayStart = fromDateKey(day);
    const dayEnd = fromDateKey(addDays(day, 1));
    const dayEvents = events
      .filter((e) => overlapsDay(e, dayStart, dayEnd))
      .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.getTime() - b.start.getTime());
    return { day, events: dayEvents };
  });
}

/** Human label for an event's time on a given day, e.g. "All day", "09:00 – 10:30", "From 22:00", "Until 02:00". */
export function formatEventTime(
  event: Pick<AgendaEvent, 'start' | 'end' | 'allDay'>,
  day: DateKey,
  formatTime: (d: Date) => string,
): string {
  if (event.allDay) return 'All day';
  const dayStart = fromDateKey(day);
  const dayEnd = fromDateKey(addDays(day, 1));
  const startsBefore = event.start < dayStart;
  const endsAfter = event.end > dayEnd;
  if (startsBefore && endsAfter) return 'All day';
  if (startsBefore) return `Until ${formatTime(event.end)}`;
  if (endsAfter) return `From ${formatTime(event.start)}`;
  if (event.end.getTime() === event.start.getTime()) return formatTime(event.start);
  return `${formatTime(event.start)} – ${formatTime(event.end)}`;
}
