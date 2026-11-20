import AsyncStorage from '@react-native-async-storage/async-storage';
import { reloadAppAsync } from 'expo';
import { File } from 'expo-file-system';
import { useState } from 'react';
import { Platform, Share, Text } from 'react-native';

import { Button } from '@/components/Button';
import { Card, ErrorText, Field, FormScreen, ScreenHeader, SectionTitle, confirmDestructive } from '@/components/ui';
import { useCollege } from '@/hooks/useCollege';
import { lastAutoBackupError, useAutoBackup } from '@/hooks/useAutoBackup';
import { useHabits } from '@/hooks/useHabits';
import { useProjects } from '@/hooks/useProjects';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { AUTO_BACKUP_EVERY_MS, autoBackupSupported, pickBackupFolder } from '@/lib/autoBackup';
import { backupSummary, buildBackup, parseBackup, writeBackup } from '@/lib/backup';

export default function BackupScreen() {
  const theme = useTheme();
  const { state: habits } = useHabits();
  const { settings, update } = useSettings();
  const { backupNow } = useAutoBackup({ auto: false });
  const [autoStatus, setAutoStatus] = useState<string | null>(null);
  const { college } = useCollege();
  const { state: projects } = useProjects();
  const [pasted, setPasted] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const data = { habits, settings, college, projects };

  const exportNow = async () => {
    const text = buildBackup(data, new Date());
    try {
      await Share.share({ message: text, title: 'BOVI backup' });
      setStatus(`Shared a backup (${Math.round(text.length / 1024)} KB).`);
    } catch {
      setError('Could not open the share sheet.');
    }
  };

  const chooseFolder = async () => {
    setAutoStatus(null);
    const uri = await pickBackupFolder();
    if (!uri) return;
    update({ autoBackupDir: uri, autoBackupAt: null }); // null = back up straight away
    setAutoStatus('Folder set. Backing up…');
  };

  const restoreFromFile = async () => {
    setStatus(null);
    try {
      const picked = await File.pickFileAsync({ mimeTypes: ['application/json', 'text/plain', '*/*'] });
      if (picked.canceled || !picked.result) return;
      restore(await picked.result.text());
    } catch {
      setError('Couldn’t open that file.');
    }
  };

  const restore = (text = pasted) => {
    setStatus(null);
    const r = parseBackup(text);
    if (!r.ok) return setError(r.error);
    setError(null);
    confirmDestructive(
      'Replace all data?',
      `This replaces everything in the app with the backup from ${r.exportedAt.slice(0, 10) || 'unknown date'} (${backupSummary(r.data)}).`,
      'Restore',
      async () => {
        await writeBackup(r.data, AsyncStorage);
        // Providers loaded their data at startup, so reload to pick up the restored stores.
        if (Platform.OS === 'web') {
          window.location.reload();
          return;
        }
        try {
          await reloadAppAsync('Restored backup');
        } catch {
          setStatus('Restored. Close and reopen the app to see it.');
        }
      },
    );
  };

  return (
    <FormScreen>
      <ScreenHeader title="Backup" />
      <Card>
        <Text style={{ color: theme.text, fontWeight: '700' }}>Your data lives only on this phone.</Text>
        <Text style={{ color: theme.muted }}>
          Export a backup now and then: share it to Google Drive, Keep, email or Files. To restore, paste the same text below.
        </Text>
        <Text style={{ color: theme.muted }}>Currently: {backupSummary(data)}</Text>
      </Card>
      <Button title="Export backup" onPress={exportNow} />
      {status ? <Text style={{ color: theme.accent }}>{status}</Text> : null}

      {autoBackupSupported ? (
        <>
          <SectionTitle>Automatic weekly backup</SectionTitle>
          <Card>
            <Text style={{ color: theme.muted }}>
              Once a week, when you open BOVI, a backup file is saved into a folder you choose (e.g. a Google Drive folder via the Drive app, or Downloads). The latest 8 are kept.
            </Text>
            {settings.autoBackupDir ? (
              <Text style={{ color: theme.text }}>
                {settings.autoBackupAt
                  ? `Last backup: ${new Date(settings.autoBackupAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}. Next after ${new Date(settings.autoBackupAt + AUTO_BACKUP_EVERY_MS).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}.`
                  : 'No backup yet.'}
              </Text>
            ) : (
              <Text style={{ color: theme.text }}>Off — choose a folder to turn it on.</Text>
            )}
            {lastAutoBackupError() ? <Text style={{ color: theme.danger }}>Last attempt failed: {lastAutoBackupError()}</Text> : null}
            {autoStatus ? <Text style={{ color: theme.accent }}>{autoStatus}</Text> : null}
            <Button title={settings.autoBackupDir ? 'Change folder' : 'Choose folder'} variant="plain" onPress={chooseFolder} />
            {settings.autoBackupDir ? (
              <>
                <Button
                  title="Back up now"
                  variant="plain"
                  onPress={async () => {
                    const r = await backupNow();
                    setAutoStatus(r.message);
                  }}
                />
                <Button title="Turn off" variant="danger" onPress={() => update({ autoBackupDir: null, autoBackupAt: null })} />
              </>
            ) : null}
          </Card>
        </>
      ) : null}

      <SectionTitle>Restore</SectionTitle>
      {Platform.OS !== 'web' ? <Button title="Restore from a backup file" variant="plain" onPress={restoreFromFile} /> : null}
      <Field label="Backup text" value={pasted} onChangeText={setPasted} placeholder='Paste the backup, starting with {"app":"habit-tracker"' multiline autoCapitalize="none" autoCorrect={false} />
      <ErrorText>{error}</ErrorText>
      <Button title="Restore from backup" variant="danger" onPress={() => restore()} />
    </FormScreen>
  );
}
