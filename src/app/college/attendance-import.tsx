import { File } from 'expo-file-system';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Share, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { ErrorText, Field, FormScreen, ScreenHeader, SectionTitle, shortDate } from '@/components/ui';
import { newId, useCollege } from '@/hooks/useCollege';
import { useTheme } from '@/hooks/useTheme';
import { ATTENDANCE_PROMPT, ATTENDANCE_STEPS, EXAMPLE_ATTENDANCE_JSON } from '@/lib/attendanceFormat';
import { applyImport, parsePortal, planImport, type PortalSnapshot } from '@/lib/attendanceImport';
import { subjectAttendance } from '@/lib/collegeStats';

/** Replace attendance with the official portal figures (paste the JSON or open the file), with a preview first. */
export default function AttendanceImportScreen() {
  const theme = useTheme();
  const c = useCollege();
  const [text, setText] = useState('');
  const [snap, setSnap] = useState<PortalSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showExample, setShowExample] = useState(false);

  const read = (input: string) => {
    const r = parsePortal(input);
    if (!r.ok) {
      setSnap(null);
      return setError(r.error);
    }
    setError(null);
    setSnap(r.snapshot);
  };

  const openFile = async () => {
    try {
      const picked = await File.pickFileAsync({ mimeTypes: ['application/json', 'text/plain', '*/*'] });
      if (picked.canceled || !picked.result) return;
      const body = await picked.result.text();
      setText(body);
      read(body);
    } catch {
      setError('Couldn’t open that file.');
    }
  };

  const rows = snap ? planImport(c.college, snap, (id) => subjectAttendance(c.college, id)) : [];

  return (
    <FormScreen>
      <ScreenHeader title="Attendance from portal" modal />
      <Text style={{ color: theme.muted }}>
        Uses the official counts (classes conducted, present, remaining, absent dates) up to the portal’s date. Classes you mark in BOVI after that date are added on top, and the “to mark” list skips anything the portal already covers.
      </Text>

      <SectionTitle>How to get the file</SectionTitle>
      <View style={[styles.box, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {ATTENDANCE_STEPS.map((step, i) => (
          <View key={i} style={styles.step}>
            <Text style={[styles.stepNum, { backgroundColor: theme.primary, color: theme.onPrimary }]}>{i + 1}</Text>
            <Text style={{ color: theme.text, flex: 1 }}>{step}</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button title="Send prompt to AI app" onPress={() => Share.share({ message: ATTENDANCE_PROMPT }).catch(() => {})} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title={showPrompt ? 'Hide prompt' : 'Show prompt'} variant="plain" onPress={() => setShowPrompt((v) => !v)} />
        </View>
      </View>
      <Text style={{ color: theme.muted, fontSize: 13 }}>“Send prompt” opens the share sheet: pick ChatGPT (or Claude / Gemini), then attach your screenshots in the same chat. Or long-press the prompt below to copy it.</Text>
      {showPrompt ? (
        <Text selectable style={[styles.code, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}>
          {ATTENDANCE_PROMPT}
        </Text>
      ) : null}
      <Button title={showExample ? 'Hide example file' : 'Show an example file'} variant="plain" onPress={() => setShowExample((v) => !v)} />
      {showExample ? (
        <Text selectable style={[styles.code, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}>
          {EXAMPLE_ATTENDANCE_JSON}
        </Text>
      ) : null}
      <Text style={{ color: theme.muted, fontSize: 13 }}>AI apps can misread screenshots, so check the preview against your portal before saving. Your file is read only on this phone.</Text>

      <SectionTitle>Import</SectionTitle>
      {Platform.OS !== 'web' ? <Button title="Open attendance file" variant="plain" onPress={openFile} /> : null}
      <Field label="…or paste the JSON" value={text} onChangeText={setText} multiline placeholder='{ "generated_on": "2026-11-19", "subjects": [ … ] }' autoCapitalize="none" autoCorrect={false} />
      <Button title="Preview" variant="plain" onPress={() => read(text)} disabled={!text.trim()} />
      <ErrorText>{error}</ErrorText>

      {snap ? (
        <>
          <SectionTitle>{`Portal figures as of ${shortDate(snap.asOf)}`}</SectionTitle>
          {rows.map((r) => {
            const before = r.before && r.before.total ? `${Math.round((r.before.present / r.before.total) * 100)}% (${r.before.present}/${r.before.total})` : 'none';
            return (
              <View key={r.portal.code || r.portal.name} style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={[styles.bar, { backgroundColor: r.subject?.color ?? theme.muted }]} />
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={styles.titleRow}>
                    <Text style={{ color: theme.text, fontWeight: '700', flexShrink: 1 }} numberOfLines={1}>
                      {r.subject ? r.subject.short : `New: ${r.portal.name}`}
                    </Text>
                    <Text style={{ color: r.percent < c.college.attendanceTarget ? theme.danger : theme.text, fontWeight: '800' }}>{Math.round(r.percent * 10) / 10}%</Text>
                  </View>
                  <Text style={{ color: theme.muted, fontSize: 13 }} numberOfLines={1}>
                    {r.portal.code} · {r.portal.name}
                  </Text>
                  <Text style={{ color: theme.muted, fontSize: 13 }}>
                    {r.portal.present}/{r.portal.conducted} present{r.portal.remaining !== undefined ? ` · ${r.portal.remaining} left` : ''} · was {before}
                  </Text>
                </View>
              </View>
            );
          })}
          <Button
            title="Use these figures"
            onPress={() => {
              c.apply((s) => applyImport(s, snap, newId));
              router.back();
            }}
          />
        </>
      ) : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 10 },
  step: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stepNum: { width: 22, height: 22, borderRadius: 11, textAlign: 'center', fontWeight: '800', overflow: 'hidden', lineHeight: 22, fontSize: 12 },
  code: { fontFamily: Platform.select({ android: 'monospace', ios: 'Menlo', default: 'monospace' }), fontSize: 12, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, padding: 10 },
  row: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  bar: { width: 4, borderRadius: 2 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
});
