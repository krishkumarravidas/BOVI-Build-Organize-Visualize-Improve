import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AttendanceButtons } from '@/components/AttendanceButtons';
import { Card, Chip, ChipRow, EmptyText, KeyboardScroll, ListRow, SectionTitle, shortDate } from '@/components/ui';
import { useCollege } from '@/hooks/useCollege';
import { useTheme } from '@/hooks/useTheme';
import { attendanceBySubject, attendanceFor, semesterOutlook, unmarkedClasses } from '@/lib/collegeStats';
import { toDateKey } from '@/lib/dates';

const TARGETS = [65, 75, 80, 85];

export default function AttendanceScreen() {
  const theme = useTheme();
  const c = useCollege();
  const { college } = c;
  const today = toDateKey(new Date());
  const { bySubject, overall } = attendanceBySubject(college);
  const unmarked = unmarkedClasses(college, today, new Date());
  const pct = (p: number | null) => (p === null ? '—' : `${Math.round(p)}%`);
  const [open, setOpen] = useState<string | null>(null);
  const synced = college.attendanceSyncedAt;

  return (
    <KeyboardScroll style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      <Card>
        <Text style={{ color: theme.muted, fontWeight: '600' }}>OVERALL</Text>
        <Text style={[styles.big, { color: overall.percent !== null && overall.percent < college.attendanceTarget ? theme.danger : theme.text }]}>
          {pct(overall.percent)}
        </Text>
        <Text style={{ color: theme.muted }}>
          {overall.present} present of {overall.total} classes
        </Text>
        <Text style={{ color: theme.muted, fontSize: 12 }}>
          {synced ? `From the college portal as of ${shortDate(synced)}, plus classes you’ve marked since.` : 'From the classes you’ve marked in BOVI.'}
        </Text>
      </Card>
      <ListRow title="Update from portal" subtitle={synced ? `Last synced ${shortDate(synced)}` : 'Paste or open the portal attendance file'} color={theme.primary} onPress={() => router.push('/college/attendance-import')} />

      <SectionTitle>Minimum required</SectionTitle>
      <ChipRow>
        {TARGETS.map((t) => (
          <Chip key={t} label={`${t}%`} selected={college.attendanceTarget === t} onPress={() => c.setAttendanceTarget(t)} />
        ))}
      </ChipRow>

      <SectionTitle>By subject</SectionTitle>
      {bySubject.map(({ subject, percent, present, total, canSkip, mustAttend, remaining }) => {
        const low = percent !== null && percent < college.attendanceTarget;
        const outlook = remaining !== null && total > 0 ? semesterOutlook(present, total, remaining, college.attendanceTarget) : null;
        const absences = (college.attendanceBaseline?.[subject.id]?.absences ?? []).slice(0, 20);
        const expanded = open === subject.id;
        return (
          <Pressable
            key={subject.id}
            onPress={() => setOpen(expanded ? null : subject.id)}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            accessibilityHint={absences.length ? 'Shows absences' : undefined}
            style={[styles.row, { backgroundColor: theme.surface, borderColor: low ? theme.danger : theme.border }]}
          >
            <View style={[styles.bar, { backgroundColor: subject.color }]} />
            <View style={{ flex: 1, gap: 2 }}>
              <View style={styles.titleRow}>
                <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                  {subject.name}
                </Text>
                <Text style={[styles.pct, { color: low ? theme.danger : theme.text }]}>{pct(percent)}</Text>
              </View>
              <Text style={{ color: theme.muted }}>
                {total === 0
                  ? 'Not marked yet'
                  : `${present}/${total} · ${low ? `attend the next ${mustAttend === Infinity ? 'all' : mustAttend} to reach ${college.attendanceTarget}%` : canSkip > 0 ? `can miss ${canSkip}` : 'on the line, don’t miss the next one'}`}
              </Text>
              {outlook ? (
                <Text style={{ color: outlook.canMissOfRemaining === null ? theme.danger : theme.muted, fontSize: 13 }}>
                  {remaining} classes left ·{' '}
                  {outlook.canMissOfRemaining === null
                    ? `can’t reach ${college.attendanceTarget}% this sem (best ${Math.round(outlook.bestFinal)}%)`
                    : outlook.canMissOfRemaining === 0
                      ? `attend all of them to end at ${college.attendanceTarget}%+`
                      : `can miss ${outlook.canMissOfRemaining} of them and still end at ${college.attendanceTarget}%+`}
                </Text>
              ) : null}
              {expanded && absences.length ? (
                <View style={{ marginTop: 6, gap: 2 }}>
                  <Text style={{ color: theme.text, fontWeight: '600', fontSize: 13 }}>Absent (portal)</Text>
                  {absences.map((a, i) => (
                    <Text key={`${a.date}-${i}`} style={{ color: theme.muted, fontSize: 13 }}>
                      {shortDate(a.date)}
                      {a.time ? ` · ${a.time}` : ''}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          </Pressable>
        );
      })}

      <SectionTitle>{`To mark (last 7 days) · ${unmarked.length}`}</SectionTitle>
      {unmarked.length === 0 ? <EmptyText>All caught up.</EmptyText> : null}
      {unmarked.map((o) => (
        <View key={`${o.date}:${o.key}`} style={[styles.markRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
              {o.subject?.short ?? o.title}
            </Text>
            <Text style={{ color: theme.muted }}>
              {shortDate(o.date)} · {o.startText}
            </Text>
          </View>
          <AttendanceButtons label={`${o.title} ${shortDate(o.date)}`} value={attendanceFor(college, o.date, o.key)} onChange={(v) => c.markAttendance(o, v)} />
        </View>
      ))}
      <EmptyText>Only subject classes count. Cancelled classes are ignored.</EmptyText>
    </KeyboardScroll>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 10, paddingBottom: 40 },
  big: { fontSize: 44, fontWeight: '800' },
  row: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  bar: { width: 4, borderRadius: 2 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  name: { fontSize: 16, fontWeight: '600', flexShrink: 1 },
  pct: { fontSize: 16, fontWeight: '800' },
  markRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
});
