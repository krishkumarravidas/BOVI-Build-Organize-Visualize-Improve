import { defaultSettings, loadSettings, normalizeServerUrl, saveSettings } from './settings';

const fake = (initial?: string) => {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set('habit-tracker/settings', initial);
  return {
    getItem: async (k: string) => data.get(k) ?? null,
    setItem: async (k: string, v: string) => void data.set(k, v),
  };
};

describe('settings', () => {
  it('defaults when empty or corrupt', async () => {
    expect(await loadSettings(fake())).toEqual(defaultSettings);
    expect(await loadSettings(fake('nope'))).toEqual(defaultSettings);
  });

  it('round-trips', async () => {
    const store = fake();
    const all = { theme: 'dark' as const, remindersEnabled: false, calendarIds: ['a', 'b'], screenTimeLimitMin: 180, examReminders: false, mode: 'gamedev' as const, briefingTime: null, appLock: true, autoBackupDir: 'content://tree/x', autoBackupAt: 5, projectsTabName: 'Work', setupDone: true, claudeSync: { url: 'https://bovi.me.workers.dev', key: 'k'.repeat(32) }, claudeSyncAt: 9 };
    await saveSettings(all, store);
    expect(await loadSettings(store)).toEqual(all);
  });

  it('sanitises unknown values per field', async () => {
    expect(await loadSettings(fake('{"theme":"neon","remindersEnabled":false}'))).toEqual({
      theme: 'system',
      remindersEnabled: false,
      calendarIds: null,
      screenTimeLimitMin: null,
      examReminders: true,
      mode: 'college',
      briefingTime: '07:30',
      appLock: false,
      autoBackupDir: null,
      autoBackupAt: null,
      projectsTabName: 'Projects',
      setupDone: false,
      claudeSync: null,
      claudeSyncAt: null,
    });
    expect((await loadSettings(fake('{"projectsTabName":"   Side   projects  "}'))).projectsTabName).toBe('Side projects');
    expect((await loadSettings(fake('{"projectsTabName":""}'))).projectsTabName).toBe('Projects');
    expect((await loadSettings(fake('{"projectsTabName":"A really very long tab name"}'))).projectsTabName).toHaveLength(16);
    expect((await loadSettings(fake('{"briefingTime":"25:00"}'))).briefingTime).toBe('07:30');
    expect((await loadSettings(fake('{"briefingTime":"06:45"}'))).briefingTime).toBe('06:45');
    expect((await loadSettings(fake('{"calendarIds":[1,2]}'))).calendarIds).toBeNull();
    expect((await loadSettings(fake('{"screenTimeLimitMin":-5}'))).screenTimeLimitMin).toBeNull();
    expect((await loadSettings(fake('{"screenTimeLimitMin":99999}'))).screenTimeLimitMin).toBeNull();
  });

  it('cleans up a pasted connector address and rejects junk', () => {
    expect(normalizeServerUrl('bovi-connector.me.workers.dev')).toBe('https://bovi-connector.me.workers.dev');
    expect(normalizeServerUrl(' https://Bovi.me.workers.dev/ ')).toBe('https://bovi.me.workers.dev');
    expect(normalizeServerUrl('https://bovi.me.workers.dev/mcp/abcdef')).toBe('https://bovi.me.workers.dev');
    expect(normalizeServerUrl('http://localhost:8787')).toBe('http://localhost:8787');
    expect(normalizeServerUrl('not a url')).toBeNull();
    expect(normalizeServerUrl('')).toBeNull();
  });

  it('drops a connector config with a too-short key', async () => {
    const s = await loadSettings(fake(JSON.stringify({ claudeSync: { url: 'bovi.me.workers.dev', key: 'short' } })));
    expect(s.claudeSync).toBeNull();
    const ok = await loadSettings(fake(JSON.stringify({ claudeSync: { url: 'bovi.me.workers.dev/', key: 'x'.repeat(32) } })));
    expect(ok.claudeSync).toEqual({ url: 'https://bovi.me.workers.dev', key: 'x'.repeat(32) });
  });
});
