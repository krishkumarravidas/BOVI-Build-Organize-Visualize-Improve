import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Chip, ChipRow, DateField, Field, KeyboardScroll } from '@/components/ui';
import { newId, useCollege } from '@/hooks/useCollege';
import { currentSemester, updateSemesterInfo } from '@/lib/semesters';
import { useProjects } from '@/hooks/useProjects';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { SUBJECT_COLORS } from '@/lib/college';
import { ensurePermission, remindersSupported } from '@/lib/notifications';
import { MAX_TAB_NAME, cleanTabName } from '@/lib/settings';

const TAB_NAMES = ['Projects', 'Game dev', 'Side projects', 'Work', 'Startup', 'Creative'];
const BRIEFING = [
  { label: 'Off', value: null },
  { label: '6:30', value: '06:30' },
  { label: '7:00', value: '07:00' },
  { label: '7:30', value: '07:30' },
  { label: '8:00', value: '08:00' },
];
const STEPS = ['Welcome', 'College', 'Attendance', 'Projects', 'Reminders', 'Done'];

/** First-run setup: college + subjects, attendance import, naming the second tab, reminders. Everything is optional. */
export default function SetupScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { settings, update } = useSettings();
  const c = useCollege();
  const p = useProjects();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState(c.college.profile ?? '');
  const [room, setRoom] = useState(c.college.defaultRoom ?? '');
  const [semName, setSemName] = useState(c.college.semester?.name ?? '');
  const [semStart, setSemStart] = useState(c.college.semester?.start ?? '');
  const [semEnd, setSemEnd] = useState(c.college.semester?.end ?? '');
  const [subjectName, setSubjectName] = useState('');
  const [subjectShort, setSubjectShort] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [tabName, setTabName] = useState(settings.projectsTabName);
  const [project, setProject] = useState('');
  const [notifStatus, setNotifStatus] = useState<string | null>(null);

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  const saveCollege = () => {
    c.setProfile({ profile: profile.trim(), defaultRoom: room.trim() });
    // Only store a semester when something was entered, and never with dates the wrong way round.
    if (semName.trim() || semStart || semEnd) {
      const end = semStart && semEnd && semEnd < semStart ? undefined : semEnd || undefined;
      c.apply((s) => updateSemesterInfo(s, { name: semName.trim() || currentSemester(s).name, start: semStart || undefined, end }));
    }
  };
  const addSubject = () => {
    const name = subjectName.trim();
    if (!name) return;
    c.upsertSubject({
      id: newId(),
      name,
      short: subjectShort.trim() || name.split(/\s+/).map((w) => w[0]?.toUpperCase() ?? '').join('').slice(0, 6) || name.slice(0, 8),
      code: subjectCode.trim() || undefined,
      color: SUBJECT_COLORS[c.college.subjects.length % SUBJECT_COLORS.length],
    });
    setSubjectName('');
    setSubjectShort('');
    setSubjectCode('');
  };
  const saveProjects = () => {
    update({ projectsTabName: cleanTabName(tabName) });
    const name = project.trim();
    if (name) {
      p.save({ id: newId(), name, status: 'active', tasks: [] });
      setProject('');
    }
  };
  const finish = (to: Parameters<typeof router.replace>[0] = '/') => {
    update({ setupDone: true });
    router.replace(to);
  };

  const card = [styles.card, { backgroundColor: theme.surface, borderColor: theme.border }];

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <View style={[styles.progress, { paddingTop: insets.top + 12 }]}>
        {STEPS.map((s, i) => (
          <View key={s} style={[styles.dot, { backgroundColor: i <= step ? theme.primary : theme.border }]} accessibilityLabel={`Step ${i + 1} of ${STEPS.length}: ${s}`} />
        ))}
      </View>
      <KeyboardScroll contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {step === 0 ? (
          <>
            <Image source={require('../../assets/icon.png')} style={styles.logo} accessibilityIgnoresInvertColors />
            <Text style={[styles.h1, { color: theme.text }]}>Welcome to BOVI</Text>
            <Text style={[styles.lead, { color: theme.muted }]}>
              One app for college and your own projects: timetable, attendance, exams and assignments on one side; projects, focus timer and habits on the other. All of it on a clock-style calendar.
            </Text>
            <View style={card}>
              <Text style={{ color: theme.text, fontWeight: '700' }}>Private by design</Text>
              <Text style={{ color: theme.muted }}>No account, no sign-up. Everything stays on this phone. Back it up from Settings → Backup.</Text>
            </View>
            <Text style={{ color: theme.muted }}>Setup takes about two minutes, and every step can be skipped or changed later in Settings.</Text>
            <Button title="Let’s set it up" onPress={next} />
            <Button title="Skip setup" variant="plain" onPress={() => finish()} />
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Text style={[styles.h1, { color: theme.text }]}>Your college</Text>
            <Field label="Course and section" value={profile} onChangeText={setProfile} placeholder="e.g. B.Tech CSE · Sem 3 · Section A" />
            <Field label="Usual classroom (optional)" value={room} onChangeText={setRoom} placeholder="e.g. Room 204" />
            <Field label="Semester (optional)" value={semName} onChangeText={setSemName} placeholder="e.g. Semester 3" />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <DateField label="Starts" value={semStart} onChange={setSemStart} optional style={{ flex: 1 }} />
              <DateField label="Ends" value={semEnd} onChange={setSemEnd} optional style={{ flex: 1 }} />
            </View>
            <Text style={{ color: theme.muted, fontSize: 13 }}>Classes only show between these dates. When the semester ends, start the next one from Classes → Semester.</Text>
            <Text style={[styles.h2, { color: theme.text }]}>Subjects</Text>
            <Text style={{ color: theme.muted }}>Add the subjects you have this semester. The course code helps match your attendance file later.</Text>
            {c.college.subjects.map((s) => (
              <View key={s.id} style={styles.subjectRow}>
                <View style={[styles.swatch, { backgroundColor: s.color }]} />
                <Text style={{ color: theme.text, flex: 1 }} numberOfLines={1}>
                  {s.name}
                </Text>
                <Text style={{ color: theme.muted }}>
                  {s.short}
                  {s.code ? ` · ${s.code}` : ''}
                </Text>
              </View>
            ))}
            <View style={card}>
              <Field label="Subject name" value={subjectName} onChangeText={setSubjectName} placeholder="e.g. Engineering Mathematics" onSubmitEditing={addSubject} />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Field label="Short name" value={subjectShort} onChangeText={setSubjectShort} placeholder="e.g. Maths" maxLength={12} />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Code (optional)" value={subjectCode} onChangeText={setSubjectCode} placeholder="e.g. MA101" autoCapitalize="characters" maxLength={20} />
                </View>
              </View>
              <Button title="Add subject" variant="plain" onPress={addSubject} disabled={!subjectName.trim()} />
            </View>
            <Text style={{ color: theme.muted, fontSize: 13 }}>Your weekly timetable comes after setup (Classes → Timetable), or skip it: importing attendance can also create subjects for you.</Text>
            <Nav onBack={back} onNext={() => { saveCollege(); next(); }} />
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Text style={[styles.h1, { color: theme.text }]}>Attendance (optional)</Text>
            <Text style={[styles.lead, { color: theme.muted }]}>
              Bring in your official attendance from the college portal: screenshot it, let an AI chat app (ChatGPT, Claude, Gemini) turn the screenshots into a file, then open that file here. The next screen walks you through it and gives you the exact prompt to use.
            </Text>
            <View style={card}>
              <Text style={{ color: theme.text }}>BOVI then shows your % per subject, how many classes you can still miss, and keeps counting as you mark classes.</Text>
            </View>
            <Button title="Import attendance now" onPress={() => router.push('/college/attendance-import')} />
            {c.college.attendanceSyncedAt ? <Text style={{ color: theme.accent, fontWeight: '600' }}>Attendance imported</Text> : null}
            <Nav onBack={back} onNext={next} nextLabel={c.college.attendanceSyncedAt ? 'Next' : 'Skip for now'} />
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Text style={[styles.h1, { color: theme.text }]}>Your second tab</Text>
            <Text style={[styles.lead, { color: theme.muted }]}>
              Next to College there’s a tab for your own stuff: projects, a focus timer, a devlog and an ideas inbox. What should it be called?
            </Text>
            <ChipRow>
              {TAB_NAMES.map((t) => (
                <Chip key={t} label={t} selected={tabName === t} onPress={() => setTabName(t)} />
              ))}
            </ChipRow>
            <Field label="Or type your own" value={tabName} onChangeText={setTabName} maxLength={MAX_TAB_NAME} placeholder="Projects" />
            <View style={[styles.preview, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.previewOn, { backgroundColor: theme.primary, color: theme.onPrimary }]}>COLLEGE</Text>
              <Text style={[styles.previewOff, { color: theme.muted }]} numberOfLines={1}>
                {cleanTabName(tabName).toUpperCase()}
              </Text>
            </View>
            <Field label="Something you’re working on (optional)" value={project} onChangeText={setProject} placeholder="e.g. My first game, Portfolio site, YouTube channel" />
            <Nav onBack={back} onNext={() => { saveProjects(); next(); }} />
          </>
        ) : null}

        {step === 4 ? (
          <>
            <Text style={[styles.h1, { color: theme.text }]}>Reminders</Text>
            <Text style={[styles.lead, { color: theme.muted }]}>BOVI can remind you before exams, deadlines and habits, and send a short morning briefing of your day.</Text>
            {remindersSupported ? (
              <>
                <Button
                  title="Allow notifications"
                  variant="plain"
                  onPress={async () => {
                    const ok = await ensurePermission();
                    update({ remindersEnabled: ok });
                    setNotifStatus(ok ? 'Notifications are on.' : 'Notifications are blocked. You can allow them later in your phone’s settings.');
                  }}
                />
                {notifStatus ? <Text style={{ color: theme.muted }}>{notifStatus}</Text> : null}
              </>
            ) : (
              <Text style={{ color: theme.muted }}>Notifications are only available in the phone app.</Text>
            )}
            <Text style={[styles.h2, { color: theme.text }]}>Morning briefing</Text>
            <ChipRow>
              {BRIEFING.map((b) => (
                <Chip key={b.label} label={b.label} selected={settings.briefingTime === b.value} onPress={() => update({ briefingTime: b.value })} />
              ))}
            </ChipRow>
            <Nav onBack={back} onNext={next} />
          </>
        ) : null}

        {step === 5 ? (
          <>
            <Text style={[styles.h1, { color: theme.text }]}>You’re set</Text>
            <View style={card}>
              <Text style={{ color: theme.text, fontWeight: '700' }}>A few things to try</Text>
              <Bullet>Add your weekly timetable: Classes → Timetable.</Bullet>
              <Bullet>Spin the dial on the calendar to move through the day, and past midnight into the next.</Bullet>
              <Bullet>Type a task into “+ Add a task” under the dial.</Bullet>
              <Bullet>Add home-screen widgets from Settings → Widgets.</Bullet>
              <Bullet>Share a link or screenshot to BOVI from any app to save it.</Bullet>
            </View>
            <Button title="Open the app" onPress={() => finish()} />
            <Button title="Set up my timetable first" variant="plain" onPress={() => finish('/college/timetable')} />
          </>
        ) : null}
      </KeyboardScroll>
    </View>
  );
}

function Nav({ onBack, onNext, nextLabel = 'Next' }: { onBack: () => void; onNext: () => void; nextLabel?: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
      <View style={{ flex: 1 }}>
        <Button title="Back" variant="plain" onPress={onBack} />
      </View>
      <View style={{ flex: 2 }}>
        <Button title={nextLabel} onPress={onNext} />
      </View>
    </View>
  );
}

function Bullet({ children }: { children: string }) {
  const theme = useTheme();
  return <Text style={{ color: theme.muted }}>• {children}</Text>;
}

const styles = StyleSheet.create({
  progress: { flexDirection: 'row', gap: 6, justifyContent: 'center', paddingBottom: 8 },
  dot: { width: 28, height: 5, borderRadius: 3 },
  content: { padding: 20, gap: 14, paddingBottom: 48 },
  logo: { width: 84, height: 84, borderRadius: 20, alignSelf: 'center', marginTop: 12 },
  h1: { fontSize: 28, fontWeight: '800' },
  h2: { fontSize: 18, fontWeight: '700', marginTop: 6 },
  lead: { fontSize: 16, lineHeight: 22 },
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 8 },
  subjectRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  swatch: { width: 12, height: 12, borderRadius: 6 },
  preview: { flexDirection: 'row', borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 4, gap: 4 },
  previewOn: { flex: 1, textAlign: 'center', fontWeight: '800', paddingVertical: 10, borderRadius: 10, overflow: 'hidden' },
  previewOff: { flex: 1, textAlign: 'center', fontWeight: '800', paddingVertical: 10 },
});
