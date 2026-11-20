import { loadJson, saveJson } from './persist';

const fake = (init?: string) => {
  const m = new Map<string, string>();
  if (init !== undefined) m.set('k', init);
  return { getItem: async (k: string) => m.get(k) ?? null, setItem: async (k: string, v: string) => void m.set(k, v) };
};
const migrate = (v: unknown) => ((v as { ok?: boolean })?.ok ? (v as { ok: boolean }) : null);

describe('loadJson', () => {
  it('seeds when empty, falls back when corrupt, and round-trips', async () => {
    expect(await loadJson('k', migrate, () => ({ ok: true, seeded: 1 }), () => ({ ok: false }), fake())).toEqual({ ok: true, seeded: 1 });
    expect(await loadJson('k', migrate, () => ({ ok: true }), () => ({ ok: false }), fake('{bad'))).toEqual({ ok: false });
    expect(await loadJson('k', migrate, () => ({ ok: true }), () => ({ ok: false }), fake('{"ok":false}'))).toEqual({ ok: false });
    const s = fake();
    await saveJson('k', { ok: true, n: 2 }, s);
    expect(await loadJson('k', migrate, () => ({ ok: false }), () => ({ ok: false }), s)).toEqual({ ok: true, n: 2 });
  });
});
