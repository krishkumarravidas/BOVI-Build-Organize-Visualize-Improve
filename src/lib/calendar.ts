import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

import { toAgendaEvent, type AgendaEvent } from './agenda';

/** Device calendars are not available on web. */
export const calendarSupported = Platform.OS !== 'web';

/** `ask`: we may show the system prompt. `blocked`: user must enable it in system settings. */
export type CalendarAccess = 'granted' | 'ask' | 'blocked';

function toAccess(res: { granted: boolean; canAskAgain: boolean }): CalendarAccess {
  if (res.granted) return 'granted';
  return res.canAskAgain ? 'ask' : 'blocked';
}

export async function getCalendarAccess(): Promise<CalendarAccess> {
  if (!calendarSupported) return 'blocked';
  return toAccess(await Calendar.getCalendarPermissions());
}

export async function requestCalendarAccess(): Promise<CalendarAccess> {
  if (!calendarSupported) return 'blocked';
  return toAccess(await Calendar.requestCalendarPermissions());
}

export interface CalendarInfo {
  id: string;
  title: string;
  color?: string;
}

export async function listDeviceCalendars(): Promise<CalendarInfo[]> {
  const calendars = await Calendar.getCalendars();
  return calendars
    .map((c) => ({ id: c.id, title: c.title || 'Untitled', color: c.color }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * Events from the selected calendars (`null` = all) overlapping [start, end).
 * Selected ids that no longer exist on the device are ignored.
 */
export async function fetchEvents(selected: string[] | null, start: Date, end: Date): Promise<AgendaEvent[]> {
  const available = (await listDeviceCalendars()).map((c) => c.id);
  const ids = selected === null ? available : selected.filter((id) => available.includes(id));
  if (ids.length === 0) return [];
  const raw = await Calendar.listEvents(ids, start, end);
  return raw.map(toAgendaEvent);
}
