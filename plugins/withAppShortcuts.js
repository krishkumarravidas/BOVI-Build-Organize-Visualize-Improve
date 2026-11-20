/**
 * Long-press app icon shortcuts (static): each opens a BOVI deep link.
 */
const fs = require('fs');
const path = require('path');
const { AndroidConfig, withAndroidManifest, withDangerousMod, withStringsXml } = require('expo/config-plugins');

const SHORTCUTS = [
  { id: 'focus', label: 'Start focus', url: 'bovi://focus' },
  { id: 'idea', label: 'Quick idea', url: 'bovi://quick-idea' },
  { id: 'attendance', label: 'Attendance', url: 'bovi://attendance' },
  { id: 'bug', label: 'Report bug', url: 'bovi://report-bug' },
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function shortcutsXml(pkg) {
  const items = SHORTCUTS.map(
    (s) => `  <shortcut
    android:shortcutId="${s.id}"
    android:enabled="true"
    android:icon="@mipmap/ic_launcher"
    android:shortcutShortLabel="@string/shortcut_${s.id}"
    android:shortcutLongLabel="@string/shortcut_${s.id}">
    <intent
      android:action="android.intent.action.VIEW"
      android:data="${esc(s.url)}"
      android:targetPackage="${pkg}"
      android:targetClass="${pkg}.MainActivity" />
  </shortcut>`,
  ).join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>\n<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">\n${items}\n</shortcuts>\n`;
}

module.exports = function withAppShortcuts(config) {
  config = withStringsXml(config, (cfg) => {
    for (const s of SHORTCUTS) {
      cfg.modResults = AndroidConfig.Strings.setStringItem([{ $: { name: `shortcut_${s.id}`, translatable: 'false' }, _: s.label }], cfg.modResults);
    }
    return cfg;
  });
  config = withAndroidManifest(config, (cfg) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(cfg.modResults);
    activity['meta-data'] = (activity['meta-data'] ?? []).filter((m) => m.$['android:name'] !== 'android.app.shortcuts');
    activity['meta-data'].push({ $: { 'android:name': 'android.app.shortcuts', 'android:resource': '@xml/shortcuts' } });
    return cfg;
  });
  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      const pkg = cfg.android?.package;
      if (!pkg) throw new Error('withAppShortcuts: android.package is required');
      const dir = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'xml');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'shortcuts.xml'), shortcutsXml(pkg));
      return cfg;
    },
  ]);
  return config;
};
