import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { DatedReminder } from './examReminders';
import { planReminders } from './reminders';
import type { Habit, ScheduleBlock } from './types';

const CHANNEL_ID = 'habit-reminders';

/** Local scheduled notifications are not supported on web. */
export const remindersSupported = Platform.OS !== 'web';

export async function hasPermission(): Promise<boolean> {
  if (!remindersSupported) return false;
  return (await Notifications.getPermissionsAsync()).granted;
}

/** Asks the OS for permission if not already granted. Returns whether reminders may be delivered. */
export async function ensurePermission(): Promise<boolean> {
  if (!remindersSupported) return false;
  if (await hasPermission()) return true;
  return (await Notifications.requestPermissionsAsync()).granted;
}

export interface ReminderSources {
  habits: readonly Habit[];
  blocks: readonly ScheduleBlock[];
  /** One-shot reminders (exams). */
  dated?: readonly DatedReminder[];
}

/**
 * Replaces all scheduled reminders with the set implied by the sources.
 * Idempotent: safe to call whenever data or settings change.
 * Returns the number of reminders scheduled.
 */
export async function syncReminders({ habits, blocks, dated = [] }: ReminderSources, enabled: boolean): Promise<number> {
  if (!remindersSupported) return 0;
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!enabled || !(await hasPermission())) return 0;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Habit reminders',
      // Real runtime enum, re-exported via `export *`, which import/namespace can't see through.
      // eslint-disable-next-line import/namespace
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const plans = planReminders(habits, blocks);
  for (const plan of plans) {
    await Notifications.scheduleNotificationAsync({
      content: { title: plan.title, body: plan.body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        channelId: CHANNEL_ID,
        weekday: plan.weekday,
        hour: plan.hour,
        minute: plan.minute,
      },
    });
  }
  for (const r of dated) {
    await Notifications.scheduleNotificationAsync({
      content: { title: r.title, body: r.body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, channelId: CHANNEL_ID, date: r.date },
    });
  }
  return plans.length + dated.length;
}
