import { seedCollege, seedProjects } from '@/lib/__fixtures__/demo';

import { buildBackup, parseBackup, writeBackup, backupSummary, COLLEGE_KEY } from './backup';
import { addHabit, createHabit, emptyState } from './habits';
import { defaultSettings } from './settings';

const data = () => ({
  habits: addHabit(emptyState(), createHabit({ name: 'Read' }, '2026-11-01', 'h')),
  settings: { ...defaultSettings, theme: 'dark' as const },
  college: seedCollege(),
  projects: seedProjects(),
});

describe('backup', () => {
  it('round-trips everything', () => {
    const text = buildBackup(data(), new Date('2026-11-15T10:00:00Z'));
    const r = parseBackup(`  ${text}\n`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data).toEqual(data());
    expect(r.exportedAt).toBe('2026-11-15T10:00:00.000Z');
    expect(backupSummary(r.data)).toBe('1 habits · 9 subjects · 6 exams · 9 projects');
  });

  it('rejects junk, other apps and damaged sections', () => {
    expect(parseBackup('hello')).toMatchObject({ ok: false });
    expect(parseBackup('{"app":"other","format":1,"data":{}}')).toMatchObject({ ok: false, error: expect.stringMatching(/BOVI/) });
    const broken = JSON.parse(buildBackup(data(), new Date()));
    broken.data.college = { version: 1 };
    expect(parseBackup(JSON.stringify(broken))).toMatchObject({ ok: false, error: expect.stringMatching(/damaged/) });
  });

  it('sanitises settings from older backups', () => {
    const old = JSON.parse(buildBackup(data(), new Date()));
    old.data.settings = { theme: 'neon' };
    const r = parseBackup(JSON.stringify(old));
    expect(r.ok && r.data.settings).toEqual(defaultSettings);
  });

  it('writes every section to its storage key', async () => {
    const m = new Map<string, string>();
    await writeBackup(data(), { getItem: async (k) => m.get(k) ?? null, setItem: async (k, v) => void m.set(k, v) });
    expect([...m.keys()].sort()).toEqual(['habit-tracker/college', 'habit-tracker/projects', 'habit-tracker/settings', 'habit-tracker/state']);
    expect(JSON.parse(m.get(COLLEGE_KEY)!).profile).toBe('Sem 3 · Section A');
  });

  it('never puts the Claude connector key in a backup', () => {
    const d = data();
    d.settings = { ...d.settings, claudeSync: { url: 'https://bovi.me.workers.dev', key: 'secret-key-0123456789abcdef' }, claudeSyncAt: 5 };
    const text = buildBackup(d, new Date());
    expect(text).not.toContain('secret-key-0123456789abcdef');
    const parsed = parseBackup(text);
    expect(parsed.ok && parsed.data.settings.claudeSync).toBe(null);
  });
});
