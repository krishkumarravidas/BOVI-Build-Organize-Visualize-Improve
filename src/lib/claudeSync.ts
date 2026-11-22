/**
 * Talks to your own BOVI connector server: sends the agent snapshot, receives what Claude added.
 * Status is kept in a tiny observable store so the Settings screen can show it.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { parseInbox, type InboxItem } from './agentSync';
import type { ClaudeSyncConfig } from './settings';

const HANDLED_KEY = 'bovi/claude-handled';
const TIMEOUT_MS = 20_000;

export type SyncStatus =
  | { state: 'idle' }
  | { state: 'syncing' }
  | { state: 'ok'; at: number; added: number }
  | { state: 'error'; at: number; message: string };

let status: SyncStatus = { state: 'idle' };
const listeners = new Set<() => void>();
const requests = new Set<() => void>();

export const getSyncStatus = () => status;
export function setSyncStatus(s: SyncStatus) {
  status = s;
  listeners.forEach((l) => l());
}
export function subscribeSyncStatus(l: () => void) {
  listeners.add(l);
  return () => void listeners.delete(l);
}

/** "Sync now": asks the running sync hook to sync immediately. */
export function requestClaudeSync() {
  requests.forEach((r) => r());
}
export function onClaudeSyncRequest(r: () => void) {
  requests.add(r);
  return () => void requests.delete(r);
}

/** Ids of items already applied, kept until the server has been told (survives app restarts). */
export async function loadHandled(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(HANDLED_KEY);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(-500) : [];
  } catch {
    return [];
  }
}
export async function saveHandled(ids: string[]) {
  try {
    await AsyncStorage.setItem(HANDLED_KEY, JSON.stringify(ids.slice(-500)));
  } catch {
    // Worst case an item is delivered again; applying it is idempotent.
  }
}

export class SyncError extends Error {}

export async function postSync(config: ClaudeSyncConfig, snapshot: unknown, handled: string[]): Promise<InboxItem[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${config.url}/sync`, {
      method: 'POST',
      headers: { authorization: `Bearer ${config.key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ snapshot, handled }),
      signal: controller.signal,
    });
  } catch {
    throw new SyncError('Couldn’t reach the server. Check the address and your internet connection.');
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 401) throw new SyncError('The server rejected the key. Copy it again from the setup output.');
  if (res.status === 404) throw new SyncError('That address isn’t a BOVI connector. Use the workers.dev address from the setup.');
  if (res.status === 503) throw new SyncError('The server isn’t finished setting up: run `npm run setup` again.');
  if (!res.ok) throw new SyncError(`The server answered ${res.status}.`);
  try {
    const body = (await res.json()) as { inbox?: unknown };
    return parseInbox(body.inbox);
  } catch {
    throw new SyncError('The server sent something unexpected.');
  }
}
