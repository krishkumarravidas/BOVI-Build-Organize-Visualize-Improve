import AsyncStorage from '@react-native-async-storage/async-storage';

import type { KeyValueStore } from './storage';

export type ThemePreference = 'system' | 'light' | 'dark';

export interface Settings {
  theme: ThemePreference;
  remindersEnabled: boolean;
  /** Device calendars shown in the agenda. `null` means all calendars. */
  calendarIds: string[] | null;
  /** Daily screen-time limit in minutes, or null for none. */
  screenTimeLimitMin: number | null;
  /** Evening-before and 1-hour-before exam reminders (needs remindersEnabled too). */
  examReminders: boolean;
  /** Which set of bottom tabs is showing. */
  mode: AppMode;
  /** Daily morning briefing notification time (HH:mm), or null for off. */
  briefingTime: string | null;
  /** Ask for fingerprint / screen lock when opening BOVI. */
  appLock: boolean;
  /** Weekly backup into a folder you picked (Android storage access URI). */
  autoBackupDir: string | null;
  /** Epoch ms of the last automatic backup. */
  autoBackupAt: number | null;
  /** Name shown for the second tab set (internally "gamedev"), e.g. "Projects", "Game dev", "Work". */
  projectsTabName: string;
  /** First-run setup finished (existing installs with data count as done). */
  setupDone: boolean;
}

export const DEFAULT_PROJECTS_TAB = 'Projects';
export const MAX_TAB_NAME = 16;

export type AppMode = 'college' | 'gamedev';

export const defaultSettings: Settings = {
  theme: 'system',
  remindersEnabled: true,
  calendarIds: null,
  screenTimeLimitMin: null,
  examReminders: true,
  mode: 'college',
  briefingTime: '07:30',
  appLock: false,
  autoBackupDir: null,
  autoBackupAt: null,
  projectsTabName: DEFAULT_PROJECTS_TAB,
  setupDone: false,
};

export const SETTINGS_KEY = 'habit-tracker/settings';
const KEY = SETTINGS_KEY;

/** Coerces anything into valid Settings, field by field. */
export function sanitizeSettings(value: unknown): Settings {
  const v = (value && typeof value === 'object' ? value : {}) as Partial<Settings>;
  return {
    theme: v.theme === 'light' || v.theme === 'dark' || v.theme === 'system' ? v.theme : defaultSettings.theme,
    remindersEnabled: typeof v.remindersEnabled === 'boolean' ? v.remindersEnabled : defaultSettings.remindersEnabled,
    calendarIds:
      Array.isArray(v.calendarIds) && v.calendarIds.every((id) => typeof id === 'string') ? v.calendarIds : defaultSettings.calendarIds,
    screenTimeLimitMin:
      typeof v.screenTimeLimitMin === 'number' && v.screenTimeLimitMin > 0 && v.screenTimeLimitMin <= 24 * 60
        ? Math.round(v.screenTimeLimitMin)
        : defaultSettings.screenTimeLimitMin,
    examReminders: typeof v.examReminders === 'boolean' ? v.examReminders : defaultSettings.examReminders,
    mode: v.mode === 'gamedev' || v.mode === 'college' ? v.mode : defaultSettings.mode,
    briefingTime:
      v.briefingTime === null ? null : typeof v.briefingTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v.briefingTime) ? v.briefingTime : defaultSettings.briefingTime,
    appLock: typeof v.appLock === 'boolean' ? v.appLock : defaultSettings.appLock,
    autoBackupDir: typeof v.autoBackupDir === 'string' && v.autoBackupDir ? v.autoBackupDir : null,
    autoBackupAt: typeof v.autoBackupAt === 'number' && Number.isFinite(v.autoBackupAt) ? v.autoBackupAt : null,
    projectsTabName: cleanTabName(v.projectsTabName),
    setupDone: typeof v.setupDone === 'boolean' ? v.setupDone : defaultSettings.setupDone,
  };
}

/** Trimmed, length-limited tab name; falls back to "Projects". */
export function cleanTabName(v: unknown): string {
  const t = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, MAX_TAB_NAME) : '';
  return t || DEFAULT_PROJECTS_TAB;
}

export async function loadSettings(store: KeyValueStore = AsyncStorage): Promise<Settings> {
  try {
    const raw = await store.getItem(KEY);
    return raw ? sanitizeSettings(JSON.parse(raw)) : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

export async function saveSettings(settings: Settings, store: KeyValueStore = AsyncStorage): Promise<void> {
  await store.setItem(KEY, JSON.stringify(settings));
}
