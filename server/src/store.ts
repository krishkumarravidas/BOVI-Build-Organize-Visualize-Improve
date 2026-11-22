/**
 * What the connector keeps: the latest snapshot from the BOVI app, when it arrived, and the queue of
 * items Claude added that the app hasn't picked up yet. Backed by Durable Object storage in production
 * and by a Map in tests.
 */

export type Snapshot = Record<string, unknown>;

export type InboxItem = { id: string; kind: 'task' | 'assignment' | 'exam' | 'idea'; createdAt: number } & Record<string, unknown>;

export interface KV {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
}

export const MAX_SNAPSHOT_BYTES = 1_000_000;
export const MAX_INBOX = 200;

export class StoreLogic {
  private kv: KV;
  constructor(kv: KV) {
    this.kv = kv;
  }

  async read(): Promise<{ snapshot: Snapshot | null; syncedAt: number | null }> {
    return { snapshot: (await this.kv.get<Snapshot>('snapshot')) ?? null, syncedAt: (await this.kv.get<number>('syncedAt')) ?? null };
  }

  async inbox(): Promise<InboxItem[]> {
    return (await this.kv.get<InboxItem[]>('inbox')) ?? [];
  }

  /** Stores the app's snapshot, drops the items it has handled, and returns what's still waiting. */
  async sync(snapshot: Snapshot, handled: string[], now: number): Promise<InboxItem[]> {
    await this.kv.put('snapshot', snapshot);
    await this.kv.put('syncedAt', now);
    const done = new Set(handled);
    const left = (await this.inbox()).filter((i) => !done.has(i.id));
    await this.kv.put('inbox', left);
    return left;
  }

  async enqueue(item: InboxItem): Promise<{ ok: true; waiting: number } | { ok: false; error: string }> {
    const list = await this.inbox();
    if (list.length >= MAX_INBOX) return { ok: false, error: `There are already ${MAX_INBOX} items waiting for the BOVI app. Open BOVI so it syncs, then try again.` };
    list.push(item);
    await this.kv.put('inbox', list);
    return { ok: true, waiting: list.length };
  }
}

export class MapKV implements KV {
  private m = new Map<string, unknown>();
  async get<T>(key: string) {
    return structuredClone(this.m.get(key)) as T | undefined;
  }
  async put<T>(key: string, value: T) {
    this.m.set(key, structuredClone(value));
  }
}
