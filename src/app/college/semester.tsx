import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card, DateField, ErrorText, Field, FormScreen, ScreenHeader, SectionTitle, confirmDestructive, shortDate } from '@/components/ui';
import { newId, useCollege } from '@/hooks/useCollege';
import { useTheme } from '@/hooks/useTheme';
import { toDateKey } from '@/lib/dates';
import {
  currentSemester,
  deleteSemester,
  nextSemesterName,
  semesterProgress,
  semesterSummary,
  startNewSemester,
  switchSemester,
  updateSemesterInfo,
  validateSemester,
} from '@/lib/semesters';

const range = (start?: string, end?: string) =>
  start && end ? `${shortDate(start)} – ${shortDate(end)}` : start ? `from ${shortDate(start)}` : end ? `until ${shortDate(end)}` : 'No dates set';

export default function SemesterScreen() {
  const theme = useTheme();
  const c = useCollege();
  // The form starts from the saved semester, so wait until it has loaded.
  if (!c.ready) return <View style={{ flex: 1, backgroundColor: theme.background }} />;
  return <SemesterForm />;
}

function SemesterForm() {
  const theme = useTheme();
  const c = useCollege();
  const { college } = c;
  const cur = currentSemester(college);
  const today = toDateKey(new Date());
  const progress = semesterProgress(cur, today);
  const past = college.pastSemesters ?? [];

  // Edit current
  const [name, setName] = useState(cur.name);
  const [start, setStart] = useState(cur.start ?? '');
  const [end, setEnd] = useState(cur.end ?? '');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // New semester
  const [creating, setCreating] = useState(false);
  const [nName, setNName] = useState(() => nextSemesterName(cur.name));
  const [nStart, setNStart] = useState(today);
  const [nEnd, setNEnd] = useState('');
  const [keepSubjects, setKeepSubjects] = useState(false);
  const [keepTimetable, setKeepTimetable] = useState(false);
  const [newError, setNewError] = useState<string | null>(null);

  const save = () => {
    const err = validateSemester({ name, start: start || undefined, end: end || undefined });
    setSaveError(err);
    if (err) return;
    c.apply((s) => updateSemesterInfo(s, { name, start: start || undefined, end: end || undefined }));
    setSaved(true);
  };

  const create = () => {
    const err = validateSemester({ name: nName, start: nStart || undefined, end: nEnd || undefined });
    setNewError(err);
    if (err) return;
    confirmDestructive(
      `Start ${nName.trim()}?`,
      `${cur.name} is saved with its subjects, attendance, exams and marks, and you can switch back to it any time. Tasks, habits and projects stay as they are.`,
      'Start semester',
      () => {
        const id = newId();
        c.apply((s) => startNewSemester(s, { name: nName, start: nStart || undefined, end: nEnd || undefined, keepSubjects, keepTimetable: keepSubjects && keepTimetable }, id));
        setName(nName.trim());
        setStart(nStart);
        setEnd(nEnd);
        setCreating(false);
        setSaved(false);
      },
    );
  };

  const switchTo = (id: string, label: string) =>
    confirmDestructive(`Switch to ${label}?`, `Classes, attendance, exams and marks will show ${label}. ${cur.name} is kept and you can switch back.`, 'Switch', () => {
      c.apply((s) => switchSemester(s, id));
      const target = past.find((p) => p.id === id);
      setName(target?.name ?? '');
      setStart(target?.start ?? '');
      setEnd(target?.end ?? '');
      setSaved(false);
    });

  const remove = (id: string, label: string) =>
    confirmDestructive(`Delete ${label}?`, 'Its subjects, timetable, attendance, exams and marks are deleted for good. Consider a backup first (Settings → Backup & restore).', 'Delete', () =>
      c.apply((s) => deleteSemester(s, id)),
    );

  return (
    <FormScreen>
      <ScreenHeader title="Semester" />

      <Card style={{ gap: 6 }}>
        <Text style={[styles.overline, { color: theme.muted }]}>CURRENT</Text>
        <Text style={[styles.title, { color: theme.text }]}>{cur.name}</Text>
        <Text style={{ color: theme.muted }}>{range(cur.start, cur.end)}</Text>
        {progress ? (
          <>
            <Text style={{ color: theme.text, fontWeight: '600' }}>
              {progress.status === 'before'
                ? `Starts ${shortDate(cur.start!)}`
                : progress.status === 'after'
                  ? 'Finished. Start the next semester below.'
                  : `Week ${progress.week}${progress.weeks ? ` of ${progress.weeks}` : ''}${progress.daysLeft !== null ? ` · ${progress.daysLeft} days left` : ''}`}
            </Text>
            {progress.weeks && progress.status === 'during' ? (
              <View style={[styles.track, { backgroundColor: theme.raised }]}>
                <View style={{ width: `${Math.min(100, (progress.week / progress.weeks) * 100)}%`, height: '100%', borderRadius: 4, backgroundColor: theme.text }} />
              </View>
            ) : null}
          </>
        ) : null}
        <Text style={{ color: theme.muted, fontSize: 13 }}>
          {college.subjects.length} subjects · {college.slots.length} classes a week · {college.exams.length} exams
        </Text>
      </Card>

      <SectionTitle>Name and dates</SectionTitle>
      <Field label="Name" value={name} onChangeText={(v) => { setName(v); setSaved(false); }} placeholder="e.g. Semester 4" />
      <View style={styles.row}>
        <DateField label="Starts" value={start} onChange={(v) => { setStart(v); setSaved(false); }} optional style={{ flex: 1 }} />
        <DateField label="Ends" value={end} onChange={(v) => { setEnd(v); setSaved(false); }} optional style={{ flex: 1 }} />
      </View>
      <Text style={{ color: theme.muted, fontSize: 13 }}>Classes only show between these dates: on the calendar, in attendance, widgets and reminders.</Text>
      <ErrorText>{saveError}</ErrorText>
      <Button title={saved ? 'Saved' : 'Save'} variant={saved ? 'plain' : 'primary'} onPress={save} />

      <SectionTitle>New semester</SectionTitle>
      {creating ? (
        <Card style={{ gap: 14 }}>
          <Field label="Name" value={nName} onChangeText={setNName} placeholder="e.g. Semester 5" />
          <View style={styles.row}>
            <DateField label="Starts" value={nStart} onChange={setNStart} optional style={{ flex: 1 }} />
            <DateField label="Ends" value={nEnd} onChange={setNEnd} optional style={{ flex: 1 }} />
          </View>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontWeight: '600' }}>Keep the same subjects</Text>
              <Text style={{ color: theme.muted, fontSize: 13 }}>Attendance, exams and marks still start fresh.</Text>
            </View>
            <Switch value={keepSubjects} onValueChange={setKeepSubjects} accessibilityLabel="Keep the same subjects" />
          </View>
          {keepSubjects ? (
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontWeight: '600' }}>Keep the weekly timetable</Text>
                <Text style={{ color: theme.muted, fontSize: 13 }}>Useful when the timetable doesn’t change.</Text>
              </View>
              <Switch value={keepTimetable} onValueChange={setKeepTimetable} accessibilityLabel="Keep the weekly timetable" />
            </View>
          ) : null}
          <ErrorText>{newError}</ErrorText>
          <Button title="Start semester" onPress={create} />
          <Button title="Cancel" variant="plain" onPress={() => setCreating(false)} />
        </Card>
      ) : (
        <>
          <Text style={{ color: theme.muted }}>
            Moving to a new semester saves {cur.name} as it is and gives you a clean timetable and attendance. You can switch back to any semester later.
          </Text>
          <Button
            title="Start a new semester"
            variant="plain"
            onPress={() => {
              setNName(nextSemesterName(cur.name));
              setCreating(true);
            }}
          />
        </>
      )}

      {past.length ? <SectionTitle>Other semesters</SectionTitle> : null}
      {past.map((p) => {
        const sum = semesterSummary(p.data, college.attendanceTarget);
        return (
          <Card key={p.id} style={{ gap: 8 }}>
            <Text style={[styles.pastName, { color: theme.text }]}>{p.name}</Text>
            <Text style={{ color: theme.muted }}>{range(p.start, p.end)}</Text>
            <Text style={{ color: theme.muted, fontSize: 13 }}>
              {sum.subjects} subjects · {sum.exams} exams · attendance {sum.attendance === null ? '—' : `${Math.round(sum.attendance)}%`}
            </Text>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Button title="Switch to this" variant="plain" onPress={() => switchTo(p.id, p.name)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title="Delete" variant="danger" onPress={() => remove(p.id, p.name)} />
              </View>
            </View>
          </Card>
        );
      })}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  overline: { fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  title: { fontSize: 24, fontWeight: '800' },
  pastName: { fontSize: 17, fontWeight: '700' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 4 },
  row: { flexDirection: 'row', gap: 12 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
