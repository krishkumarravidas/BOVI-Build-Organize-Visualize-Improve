import { Directory, File } from 'expo-file-system';
import { Platform } from 'react-native';

import { toDateKey } from './dates';

export const AUTO_BACKUP_EVERY_MS = 7 * 86_400_000;
export const KEEP_BACKUPS = 8;
const PREFIX = 'bovi-backup-';

export const autoBackupSupported = Platform.OS === 'android';

export function backupDue(lastAt: number | null, now: number): boolean {
  return lastAt === null || now - lastAt >= AUTO_BACKUP_EVERY_MS;
}

export function backupFileName(now: Date): string {
  return `${PREFIX}${toDateKey(now)}.json`;
}

/** Plain file name from a File name that may be an encoded SAF document id ("primary%3ADownload%2Fx.json"). */
export function baseName(name: string): string {
  let n = name;
  try {
    n = decodeURIComponent(name);
  } catch {
    // keep as is
  }
  return n.split(/[/:]/).pop() ?? n;
}

/** Oldest backups beyond the newest `keep` (names sort by date). */
export function backupsToPrune(names: readonly string[], keep = KEEP_BACKUPS): string[] {
  const ours = names.filter((n) => n.startsWith(PREFIX) && n.endsWith('.json')).sort();
  return ours.slice(0, Math.max(0, ours.length - keep));
}

/** Lets you pick (and grants lasting access to) the folder backups go into. Returns its URI or null. */
export async function pickBackupFolder(): Promise<string | null> {
  try {
    const dir = await Directory.pickDirectoryAsync();
    return dir?.uri ?? null;
  } catch {
    return null;
  }
}

/** Writes today's backup into the folder (replacing today's if it exists) and prunes old ones. */
export async function writeBackupFile(dirUri: string, json: string, now: Date): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  try {
    const dir = new Directory(dirUri);
    const name = backupFileName(now);
    const entries = dir.list();
    for (const e of entries) if (e instanceof File && baseName(e.name) === name) e.delete();
    const file = dir.createFile(name, 'application/json');
    file.write(json);
    const names = dir.list().filter((e): e is File => e instanceof File).map((e) => baseName(e.name));
    const prune = new Set(backupsToPrune(names));
    for (const e of dir.list()) if (e instanceof File && prune.has(baseName(e.name))) e.delete();
    return { ok: true, name };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Couldn’t write to the backup folder. Pick it again.' };
  }
}
