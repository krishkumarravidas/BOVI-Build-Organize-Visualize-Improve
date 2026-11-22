import { useEffect, useState, useSyncExternalStore } from 'react';
import { Linking, Share, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card, ErrorText, Field, FormScreen, ScreenHeader, SectionTitle, confirmDestructive } from '@/components/ui';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { getSyncStatus, requestClaudeSync, subscribeSyncStatus } from '@/lib/claudeSync';
import { normalizeServerUrl } from '@/lib/settings';

const GUIDE_URL = 'https://github.com/krishkumarravidas/BOVI-Build-Organize-Visualize-Improve/blob/main/docs/claude-connector.md';

const CAN_READ = ['Timetable, with one-off changes', 'Attendance, and how many classes you can miss', 'Exams, syllabus and readiness', 'Assignments, tasks and today’s habits', 'Projects, milestones and ideas'];
const CAN_ADD = ['Tasks', 'Assignments', 'Exams', 'Ideas'];

function ago(ms: number, now: number): string {
  const m = Math.round((now - ms) / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
}

export default function ClaudeConnectorScreen() {
  const theme = useTheme();
  const { settings, update } = useSettings();
  const status = useSyncExternalStore(subscribeSyncStatus, getSyncStatus, getSyncStatus);
  const config = settings.claudeSync;
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const connect = () => {
    const u = normalizeServerUrl(url);
    const k = key.trim();
    if (!u) return setError('Paste the workers.dev address from the setup, e.g. https://bovi-connector.you.workers.dev');
    if (k.length < 16) return setError('Paste the whole key from the setup output.');
    setError(null);
    update({ claudeSync: { url: u, key: k }, claudeSyncAt: null });
  };

  const disconnect = () =>
    confirmDestructive('Disconnect Claude?', 'BOVI stops syncing. Your data on the server stays until you delete the server from Cloudflare.', 'Disconnect', () => {
      update({ claudeSync: null, claudeSyncAt: null });
      setUrl('');
      setKey('');
    });

  const connectorUrl = config ? `${config.url}/mcp/${config.key}` : '';
  const host = config ? config.url.replace(/^https?:\/\//, '') : '';
  const lastAt = status.state === 'ok' || status.state === 'error' ? status.at : settings.claudeSyncAt;

  return (
    <FormScreen>
      <ScreenHeader title="Claude connector" />
      <Text style={[styles.lead, { color: theme.muted }]}>
        Ask Claude about your day (“can I skip Friday’s DSA class?”, “what’s due this week?”) and let it add things to BOVI. It works through a small private server you own, so nobody else, including the BOVI developer, sees your data.
      </Text>

      {config ? (
        <>
          <Card>
            <View style={styles.statusRow}>
              <View style={[styles.dot, { backgroundColor: status.state === 'error' ? theme.danger : status.state === 'syncing' ? theme.warn : theme.accent }]} />
              <Text style={[styles.statusTitle, { color: theme.text }]}>
                {status.state === 'syncing' ? 'Syncing…' : status.state === 'error' ? 'Sync failed' : 'Connected'}
              </Text>
            </View>
            <Text style={{ color: theme.muted }}>{host}</Text>
            <Text style={{ color: theme.muted }}>
              {lastAt ? `Last synced ${ago(lastAt, Math.max(now, lastAt))}` : 'Not synced yet'}
              {status.state === 'ok' && status.added ? ` · ${status.added} new from Claude` : ''}
            </Text>
            {status.state === 'error' ? <ErrorText>{status.message}</ErrorText> : null}
          </Card>
          <Button title="Sync now" onPress={requestClaudeSync} disabled={status.state === 'syncing'} />

          <SectionTitle>Add to Claude</SectionTitle>
          <Text style={{ color: theme.muted }}>
            In Claude: Settings → Connectors → Add custom connector. Name it BOVI and paste this address. Keep it private: it works like a password.
          </Text>
          <Card>
            <Text selectable numberOfLines={2} style={[styles.mono, { color: theme.text }]}>
              {connectorUrl}
            </Text>
          </Card>
          <Button title="Share connector address" variant="plain" onPress={() => Share.share({ message: connectorUrl })} />
        </>
      ) : (
        <>
          <SectionTitle>Set up (about 5 minutes, once)</SectionTitle>
          <Card style={{ gap: 10 }}>
            {[
              'On a computer with Node.js, download BOVI from GitHub and run: cd server, then npm install, then npm run setup.',
              'Sign in to Cloudflare when the browser opens (the free plan is enough).',
              'The setup prints a server address and a key: paste them below.',
              'It also prints a connector address for Claude: add it in Claude → Settings → Connectors.',
            ].map((t, i) => (
              <View key={i} style={styles.step}>
                <Text style={[styles.stepNum, { color: theme.text, backgroundColor: theme.raised }]}>{i + 1}</Text>
                <Text style={{ color: theme.text, flex: 1 }}>{t}</Text>
              </View>
            ))}
          </Card>
          <Button title="Open the full guide" variant="plain" onPress={() => Linking.openURL(GUIDE_URL)} />

          <Field label="Server address" value={url} onChangeText={setUrl} placeholder="https://bovi-connector.you.workers.dev" autoCapitalize="none" autoCorrect={false} keyboardType="url" />
          <Field label="Key" value={key} onChangeText={setKey} placeholder="From the setup output" autoCapitalize="none" autoCorrect={false} secureTextEntry />
          <ErrorText>{error}</ErrorText>
          <Button title="Connect" onPress={connect} />
        </>
      )}

      <SectionTitle>What Claude can do</SectionTitle>
      <Card style={{ gap: 6 }}>
        <Text style={[styles.listHead, { color: theme.text }]}>Read</Text>
        {CAN_READ.map((t) => (
          <Text key={t} style={{ color: theme.muted }}>• {t}</Text>
        ))}
        <Text style={[styles.listHead, { color: theme.text, marginTop: 8 }]}>Add</Text>
        <Text style={{ color: theme.muted }}>{CAN_ADD.join(', ')}. They appear here on the next sync.</Text>
        <Text style={{ color: theme.muted, marginTop: 8 }}>Claude can’t edit or delete anything in BOVI. The key is never included in backups.</Text>
      </Card>

      {config ? <Button title="Disconnect" variant="danger" onPress={disconnect} /> : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  lead: { fontSize: 15, lineHeight: 21 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  statusTitle: { fontSize: 17, fontWeight: '700' },
  mono: { fontFamily: 'monospace', fontSize: 13 },
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepNum: { width: 26, height: 26, borderRadius: 8, textAlign: 'center', lineHeight: 26, fontWeight: '700', overflow: 'hidden' },
  listHead: { fontWeight: '700' },
});
