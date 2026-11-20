import { addHabit, createHabit, emptyState } from './habits';
import { loadState, saveState, type KeyValueStore } from './storage';

function fakeStore(initial?: string): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set('habit-tracker/state', initial);
  return {
    data,
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => void data.set(k, v),
  };
}

describe('storage', () => {
  it('returns empty state when nothing is stored', async () => {
    expect(await loadState(fakeStore())).toEqual(emptyState());
  });

  it('round-trips state', async () => {
    const store = fakeStore();
    const state = addHabit(emptyState(), createHabit({ name: 'x' }, '2026-11-10', 'a'));
    await saveState(state, store);
    expect(await loadState(store)).toEqual(state);
  });

  it('falls back to empty state on corrupt JSON or wrong shape', async () => {
    expect(await loadState(fakeStore('{not json'))).toEqual(emptyState());
    expect(await loadState(fakeStore('{"version":2}'))).toEqual(emptyState());
  });
});

describe('migrateState', () => {
  it('upgrades version 1 data by adding an empty schedule', async () => {
    const v1 = { version: 1, habits: [{ id: 'a', name: 'x', days: [1], createdAt: '2026-11-01' }], completions: { a: ['2026-11-02'] } };
    const loaded = await loadState(fakeStore(JSON.stringify(v1)));
    expect(loaded).toEqual({ version: 2, habits: v1.habits, completions: v1.completions, blocks: [] });
  });

  it('rejects version 2 data without blocks', async () => {
    const bad = { version: 2, habits: [], completions: {} };
    expect(await loadState(fakeStore(JSON.stringify(bad)))).toEqual(emptyState());
  });
});
