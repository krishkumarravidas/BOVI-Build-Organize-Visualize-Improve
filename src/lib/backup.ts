import { migrateCollege, type CollegeState } from './college';
import { migrateProjects, type ProjectsState } from './projects';
import { sanitizeSettings, SETTINGS_KEY, type Settings } from './settings';
import { HABITS_KEY, migrateState, type KeyValueStore } from './storage';
import type { HabitState } from './types';

export const COLLEGE_KEY = 'habit-tracker/college';
export const PROJECTS_KEY = 'habit-tracker/projects';

export interface BackupData {
  habits: HabitState;
  settings: Settings;
  college: CollegeState;
  projects: ProjectsState;
}

interface BackupFile {
  app: 'habit-tracker';
  format: 1;
  exportedAt: string;
  data: BackupData;
}

export function buildBackup(data: BackupData, now: Date): string {
  const file: BackupFile = { app: 'habit-tracker', format: 1, exportedAt: now.toISOString(), data };
  return JSON.stringify(file);
}

export type ParseResult = { ok: true; data: BackupData; exportedAt: string } | { ok: false; error: string };

/** Validates a pasted backup; every section goes through the same migration as normal loading. */
export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text.trim());
  } catch {
    return { ok: false, error: 'That isn’t valid backup text. Paste the whole thing, from { to }.' };
  }
  const f = raw as Partial<BackupFile> | null;
  if (!f || f.app !== 'habit-tracker' || f.format !== 1 || !f.data) return { ok: false, error: 'This doesn’t look like a BOVI backup.' };
  const habits = migrateState(f.data.habits);
  const college = migrateCollege(f.data.college);
  const projects = migrateProjects(f.data.projects);
  if (!habits || !college || !projects) return { ok: false, error: 'The backup is incomplete or damaged.' };
  return { ok: true, exportedAt: String(f.exportedAt ?? ''), data: { habits, college, projects, settings: sanitizeSettings(f.data.settings) } };
}

export async function writeBackup(data: BackupData, store: KeyValueStore): Promise<void> {
  await store.setItem(HABITS_KEY, JSON.stringify(data.habits));
  await store.setItem(SETTINGS_KEY, JSON.stringify(data.settings));
  await store.setItem(COLLEGE_KEY, JSON.stringify(data.college));
  await store.setItem(PROJECTS_KEY, JSON.stringify(data.projects));
}

export function backupSummary(d: BackupData): string {
  return [
    `${d.habits.habits.length} habits`,
    `${d.college.subjects.length} subjects`,
    `${d.college.exams.length} exams`,
    `${d.projects.projects.length} projects`,
  ].join(' · ');
}
