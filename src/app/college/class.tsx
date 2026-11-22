import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { AttendanceButtons } from '@/components/AttendanceButtons';
import { Button } from '@/components/Button';
import { LinkList } from '@/components/LinkList';
import { Card, Chip, ChipRow, DateField, ErrorText, Field, FormScreen, ScreenHeader, SectionTitle, TimeRangeFields, confirmDestructive, shortDate } from '@/components/ui';
import { useCollege } from '@/hooks/useCollege';
import { useTheme } from '@/hooks/useTheme';
import { resolveDay, validateTimeRange } from '@/lib/college';
import { attendanceFor } from '@/lib/collegeStats';
import { addDays, isValidDateKey, toDateKey } from '@/lib/dates';

/** Actions for one class on one date: change it just for that day, move it, cancel/restore it. */
export default function ClassOccurrenceScreen() {
  const { date, key } = useLocalSearchParams<{ date: string; key: string }>();
  const theme = useTheme();
  const c = useCollege();
  const occ = resolveDay(c.college, date).find((o) => o.key === key);

  const [start, setStart] = useState(occ?.startText ?? '');
  const [end, setEnd] = useState(occ?.endText ?? '');
  const [room, setRoom] = useState(occ?.room ?? '');
  const [target, setTarget] = useState(date ? addDays(date, 1) : '');
  const [mStart, setMStart] = useState(occ?.startText ?? '');
  const [mEnd, setMEnd] = useState(occ?.endText ?? '');
  const [error, setError] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

  if (!occ) {
    return (
      <FormScreen>
        <ScreenHeader title="Class" modal />
        <Text style={{ color: theme.muted }}>This class no longer exists on {date}.</Text>
      </FormScreen>
    );
  }

  const isExtra = occ.status === 'extra';
  const today = toDateKey(new Date());
  const targets = Array.from({ length: 14 }, (_, i) => addDays(today, i)).filter((d) => d !== date);

  const saveDayChange = () => {
    const err = validateTimeRange(start, end);
    if (err) return setError(err);
    if (isExtra) {
      const extra = c.college.changes.find((x) => x.id === occ.changeId);
      if (extra?.kind === 'extra') {
        c.deleteChange(extra.id);
        c.addExtra({ ...extra, start, end, room: room || undefined });
      }
    } else {
      c.editClass(date, occ.slotId!, { start, end, room: room || undefined });
    }
    router.back();
  };

  const move = () => {
    if (!isValidDateKey(target)) return setMoveError('Pick a day or type a date like 2026-11-21');
    const err = validateTimeRange(mStart, mEnd);
    if (err) return setMoveError(err);
    c.moveClass(occ, { date: target, start: mStart, end: mEnd });
    router.back();
  };

  return (
    <FormScreen>
      <ScreenHeader title="Change class" modal />
      <Card>
        <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>{occ.title}</Text>
        <Text style={{ color: theme.muted }}>
          {shortDate(date)} · {occ.startText}–{occ.endText} · {occ.room}
        </Text>
        {occ.status !== 'regular' ? (
          <Text style={{ color: occ.status === 'cancelled' ? theme.danger : theme.accent, fontWeight: '700' }}>
            {occ.status === 'cancelled' ? 'Cancelled for this day' : occ.status === 'changed' ? 'Changed for this day' : 'Extra class'}
          </Text>
        ) : null}
        {occ.note ? <Text style={{ color: theme.muted }}>{occ.note}</Text> : null}
      </Card>

      {occ.subject ? (
        <>
          <SectionTitle
            right={<Button title="Edit" variant="plain" onPress={() => router.push({ pathname: '/college/subject/[id]', params: { id: occ.subject!.id } })} />}
          >
            {`${occ.subject.short} links`}
          </SectionTitle>
          <LinkList links={occ.subject.links} emptyText="No links yet. Tap Edit to add the Drive folder, notes or Classroom." />
        </>
      ) : null}

      {occ.status !== 'cancelled' && occ.subject ? (
        <>
          <SectionTitle>Attendance</SectionTitle>
          <AttendanceButtons label={occ.title} value={attendanceFor(c.college, date, occ.key)} onChange={(v) => c.markAttendance(occ, v)} />
        </>
      ) : null}

      {occ.status !== 'cancelled' ? (
        <>
          <SectionTitle>Change for this day only</SectionTitle>
          <TimeRangeFields start={start} end={end} onStart={setStart} onEnd={setEnd} />
          <Field label="Room" value={room} onChangeText={setRoom} placeholder={c.college.defaultRoom} />
          <ErrorText>{error}</ErrorText>
          <Button title="Save change" onPress={saveDayChange} />

          <SectionTitle>Move to another day</SectionTitle>
          <ChipRow>
            {targets.map((d) => (
              <Chip key={d} label={shortDate(d)} selected={d === target} onPress={() => setTarget(d)} />
            ))}
          </ChipRow>
          <DateField label="Date" value={target} onChange={setTarget} hint="Pick a day above, or tap to choose any date." />
          <TimeRangeFields start={mStart} end={mEnd} onStart={setMStart} onEnd={setMEnd} />
          <ErrorText>{moveError}</ErrorText>
          <Button title="Move class" variant="plain" onPress={move} />
        </>
      ) : null}

      <SectionTitle>More</SectionTitle>
      {occ.status === 'changed' || occ.status === 'cancelled' ? (
        <Button
          title="Restore regular class"
          variant="plain"
          onPress={() => {
            c.restoreClass(date, occ.slotId!);
            router.back();
          }}
        />
      ) : null}
      {!isExtra && occ.status !== 'cancelled' ? (
        <Button
          title="Cancel this class"
          variant="danger"
          onPress={() =>
            confirmDestructive('Cancel class?', `${occ.title} on ${shortDate(date)} will be marked cancelled.`, 'Cancel class', () => {
              c.cancelClass(date, occ.slotId!);
              router.back();
            })
          }
        />
      ) : null}
      {isExtra ? (
        <Button
          title="Delete extra class"
          variant="danger"
          onPress={() =>
            confirmDestructive('Delete class?', `${occ.title} on ${shortDate(date)} will be removed.`, 'Delete', () => {
              c.deleteChange(occ.changeId!);
              router.back();
            })
          }
        />
      ) : (
        <Button title="Edit weekly timetable entry" variant="plain" onPress={() => router.push({ pathname: '/college/slot/[id]', params: { id: occ.slotId! } })} />
      )}
    </FormScreen>
  );
}
