import * as Notifications from 'expo-notifications';

import { syncReminders } from './notifications';
import type { Habit } from './types';

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => {}),
  scheduleNotificationAsync: jest.fn(async () => 'id'),
  setNotificationChannelAsync: jest.fn(async () => null),
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { WEEKLY: 'weekly', DATE: 'date' },
}));

const mocked = Notifications as jest.Mocked<typeof Notifications>;
const habit: Habit = { id: 'a', name: 'Run', days: [1, 2], createdAt: '2026-11-01', reminderTime: '08:00' };

beforeEach(() => jest.clearAllMocks());

describe('syncReminders', () => {
  it('cancels existing and schedules weekly reminders when permitted', async () => {
    mocked.getPermissionsAsync.mockResolvedValue({ granted: true } as never);
    expect(await syncReminders({ habits: [habit], blocks: [] }, true)).toBe(2);
    expect(mocked.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(mocked.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({ title: 'Run' }),
        trigger: expect.objectContaining({ type: 'weekly', weekday: 2, hour: 8, minute: 0 }),
      }),
    );
  });

  it('also schedules reminders for schedule blocks', async () => {
    mocked.getPermissionsAsync.mockResolvedValue({ granted: true } as never);
    const block = { id: 'b', title: 'Gym', start: '18:00', end: '19:00', remind: true };
    expect(await syncReminders({ habits: [], blocks: [{ ...block, days: [6] }] }, true)).toBe(1);
    expect(mocked.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: { title: 'Gym', body: 'Starting now, until 19:00.' },
        trigger: expect.objectContaining({ weekday: 7, hour: 18, minute: 0 }),
      }),
    );
  });

  it('schedules one-shot dated reminders (exams)', async () => {
    mocked.getPermissionsAsync.mockResolvedValue({ granted: true } as never);
    const date = new Date(2026, 10, 15, 20, 0);
    expect(await syncReminders({ habits: [], blocks: [], dated: [{ id: 'x', title: 'IA1 tomorrow', body: 'b', date }] }, true)).toBe(1);
    expect(mocked.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({ content: { title: 'IA1 tomorrow', body: 'b' }, trigger: expect.objectContaining({ type: 'date', date }) }),
    );
  });

  it('only cancels when disabled', async () => {
    expect(await syncReminders({ habits: [habit], blocks: [] }, false)).toBe(0);
    expect(mocked.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(mocked.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('schedules nothing without permission', async () => {
    mocked.getPermissionsAsync.mockResolvedValue({ granted: false } as never);
    expect(await syncReminders({ habits: [habit], blocks: [] }, true)).toBe(0);
    expect(mocked.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});
