import * as Calendar from 'expo-calendar';

import { fetchEvents, getCalendarAccess, requestCalendarAccess } from './calendar';

jest.mock('expo-calendar', () => ({
  getCalendarPermissions: jest.fn(),
  requestCalendarPermissions: jest.fn(),
  getCalendars: jest.fn(),
  listEvents: jest.fn(),
}));

const mocked = Calendar as jest.Mocked<typeof Calendar>;
const start = new Date(2026, 10, 15);
const end = new Date(2026, 10, 22);

beforeEach(() => {
  jest.clearAllMocks();
  mocked.getCalendars.mockResolvedValue([
    { id: 'work', title: 'Work' },
    { id: 'home', title: 'Home' },
  ] as never);
  mocked.listEvents.mockResolvedValue([
    { id: 'e1', calendarId: 'work', title: 'Standup', startDate: '2026-11-16T09:00:00', endDate: '2026-11-16T09:15:00', allDay: false },
  ] as never);
});

describe('calendar access', () => {
  it.each([
    [{ granted: true, canAskAgain: true }, 'granted'],
    [{ granted: false, canAskAgain: true }, 'ask'],
    [{ granted: false, canAskAgain: false }, 'blocked'],
  ])('maps %p to %p', async (res, expected) => {
    mocked.getCalendarPermissions.mockResolvedValue(res as never);
    mocked.requestCalendarPermissions.mockResolvedValue(res as never);
    expect(await getCalendarAccess()).toBe(expected);
    expect(await requestCalendarAccess()).toBe(expected);
  });
});

describe('fetchEvents', () => {
  it('uses every calendar when none are selected', async () => {
    const events = await fetchEvents(null, start, end);
    expect(mocked.listEvents).toHaveBeenCalledWith(['home', 'work'], start, end);
    expect(events[0]).toMatchObject({ id: 'e1', title: 'Standup', allDay: false });
  });

  it('ignores selected calendars that no longer exist', async () => {
    await fetchEvents(['work', 'gone'], start, end);
    expect(mocked.listEvents).toHaveBeenCalledWith(['work'], start, end);
  });

  it('skips the query when nothing is selected', async () => {
    expect(await fetchEvents([], start, end)).toEqual([]);
    expect(mocked.listEvents).not.toHaveBeenCalled();
  });
});
