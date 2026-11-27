import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions, type ViewStyle } from 'react-native';

import { CalendarAccessNotice } from '@/components/CalendarAccessNotice';
import { DayRings } from '@/components/DayRings';
import { RadialDay } from '@/components/RadialDay';
import { useCalendarEvents } from '@/hooks/useCalendarEvents';
import { newId, useCollege } from '@/hooks/useCollege';
import { useRotatingDial } from '@/hooks/useDialRotation';
import { useHabits } from '@/hooks/useHabits';
import { useProjects } from '@/hooks/useProjects';
import { useHourlyScreenTime } from '@/hooks/useHourlyScreenTime';
import { markSession } from '@/lib/courses';
import { useSettings } from '@/hooks/useSettings';
import { PhoneUseCard } from '@/components/PhoneUseCard';
import { useTheme } from '@/hooks/useTheme';
import { formatEventTime } from '@/lib/agenda';
import { dayProgress, dayScore } from '@/lib/calendarLayout';
import { countdownLabel, upcomingExams } from '@/lib/college';
import { addDays, fromDateKey, toDateKey } from '@/lib/dates';
import { gamedevDueOn, setLaunchItem } from '@/lib/gamedev';
import { habitsForDay, isCompleted } from '@/lib/habits';
import { weekStart } from '@/lib/insights';
import { PERIODS, WINDOW_MIN, hitTestContent, periodOfWindow, periodTitle, windowAround } from '@/lib/radial';
import { buildTimeline, type TimelineItem } from '@/lib/timeline';
import { timelinePress } from '@/lib/timelineNav';
import { setTodoDone, untimedTodos, upsertTodo } from '@/lib/todos';
import type { DateKey } from '@/lib/types';
import { mix } from '@/theme/contrast';
import { KeyboardScroll } from '@/components/ui';

// Web-only: stop text selection while dragging the dial (not part of RN's style types).
const NO_SELECT = Platform.OS === 'web' ? ({ userSelect: 'none' } as unknown as ViewStyle) : null;

const fmtTime = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

export default function CalendarScreen() {
  const theme = useTheme();
  const { width, height: winH } = useWindowDimensions();
  const now = new Date();
  const today = toDateKey(now);
  const [day, setDay] = useState<DateKey>(today);
  const monday = weekStart(day);
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  const { state, toggle, apply: applyHabits } = useHabits();
  const { college, toggleStudy, toggleAssignment } = useCollege();
  const projects = useProjects();
  // A day either side of the week, so the dial can show events across midnight at the week's edges.
  const calendar = useCalendarEvents(9, addDays(monday, -1));
  const hourly = useHourlyScreenTime(day);
  const { settings } = useSettings();

  const dialW = width;
  const dialH = Math.max(300, Math.min(width * 1.3, winH * 0.56));
  // Memoised so spinning the dial (header updates) doesn't rebuild or re-render the drawing.
  const timeline = useMemo(
    () => buildTimeline(day, { events: calendar.events, blocks: state.blocks, habitState: state, college, courses: projects.state.courses }),
    [day, calendar.events, state, college, projects.state.courses],
  );
  // The dial also draws yesterday's and tomorrow's items, so it reads continuously across midnight.
  const dialItems = useMemo(() => {
    const src = { events: calendar.events, blocks: state.blocks, habitState: state, college, courses: projects.state.courses };
    const seen = new Set(timeline.items.map((i) => i.key));
    const near = [addDays(day, -1), addDays(day, 1)].flatMap((d) => buildTimeline(d, src).items.filter((i) => !seen.has(i.key)).map((i) => ({ ...i, key: `${d}:${i.key}` })));
    return [...timeline.items, ...near];
  }, [day, calendar.events, state, college, projects.state.courses, timeline]);
  const dayStart = useMemo(() => fromDateKey(day), [day]);
  // Minutes from this day's midnight (negative or past 24 h for other days); the dial draws the hand only when it's in view.
  const nowMin = Math.round((now.getTime() - dayStart.getTime()) / 60_000);

  const toggleTask = (id: string, done: boolean) => applyHabits((s) => setTodoDone(s, id, done, Date.now()));
  const applyProjects = projects.apply;
  const toggleCourse = useCallback(
    (courseId: string, slotId: string, date: DateKey, done: boolean) =>
      applyProjects((s) => ({ ...s, courses: (s.courses ?? []).map((c) => (c.id === courseId ? markSession(c, date, slotId, done ? 'done' : null) : c)) })),
    [applyProjects],
  );
  // Items can come from the neighbouring days, so act on the item's own date.
  const press = (item: TimelineItem) => {
    const itemDay = toDateKey(item.start);
    if (item.kind === 'habit') toggle(item.habitId, itemDay, !item.done);
    else if (item.kind === 'study') toggleStudy(item.studyId);
    else if (item.kind === 'task') toggleTask(item.taskId, !item.done);
    else if (item.kind === 'course') toggleCourse(item.courseId, item.slotId, itemDay, !item.done);
    else timelinePress(item, itemDay)?.();
  };

  // Rigid dial: drag to rotate (the drawing turns as one piece); chips animate; taps hit-test through the rotation.
  const onTap = useCallback(
    (x: number, y: number, rotationDeg: number, baseMin: number) => {
      const item = hitTestContent(dialItems, new Date(dayStart.getTime() + baseMin * 60_000), rotationDeg, dialW, dialH, x, y);
      if (!item) return;
      const itemDay = toDateKey(item.start);
      if (item.kind === 'habit') toggle(item.habitId, itemDay, !item.done);
      else if (item.kind === 'study') toggleStudy(item.studyId);
      else if (item.kind === 'task') applyHabits((s) => setTodoDone(s, item.taskId, !item.done, Date.now()));
      else if (item.kind === 'course') toggleCourse(item.courseId, item.slotId, itemDay, !item.done);
      else timelinePress(item, itemDay)?.();
    },
    [dialItems, dayStart, dialW, dialH, toggle, toggleStudy, applyHabits, toggleCourse],
  );
  const dialSize = useMemo(() => ({ width: dialW, height: dialH }), [dialW, dialH]);
  // Spinning past midnight moves the calendar to the next/previous day.
  const onDayShift = useCallback((delta: number) => setDay((d) => addDays(d, delta)), [setDay]);
  const rotation = useRotatingDial({ initialStart: windowAround(new Date()), size: dialSize, onTap, onDayShift });
  const [quickTask, setQuickTask] = useState('');
  const addQuickTask = () => {
    const title = quickTask.trim();
    if (!title) return;
    applyHabits((s) => upsertTodo(s, { id: newId(), title, date: day, done: false }));
    setQuickTask('');
  };
  const animateTo = rotation.animateTo;
  const startMin = rotation.startMin;
  const period = periodOfWindow(startMin);

  const periodStart = new Date(fromDateKey(day).getTime() + startMin * 60_000);
  const periodEnd = new Date(periodStart.getTime() + WINDOW_MIN * 60_000);
  const inPeriod = timeline.items.filter((i) => (i.kind === 'habit' ? i.start >= periodStart && i.start <= periodEnd : i.start < periodEnd && i.end > periodStart));

  const untimedHabits = habitsForDay(state, day).filter((h) => !h.reminderTime);
  const todos = untimedTodos(state, day, today);
  const due = college.assignments.filter((a) => a.due === day);
  const allDayEvents = timeline.allDay.filter((e) => !e.id.startsWith('assignment:'));
  const gamedev = gamedevDueOn(projects.state, day);
  const soonExam = day === today ? upcomingExams(college, today).find((e) => e.daysAway <= 3) : undefined;
  const progress = Object.fromEntries(week.map((d) => {
    const p = dayProgress(state, college, d);
    return [d, dayScore(p.done, p.total)];
  }));


  const date = fromDateKey(day);
  const periodLabel = `${fmtTime(periodStart)} – ${fmtTime(periodEnd)}`;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <KeyboardScroll
        contentContainerStyle={styles.scroll}
        scrollEnabled={!rotation.dragging}
        onScroll={rotation.onScroll}
        scrollEventThrottle={16}
      >
        <View style={styles.header}>
          <View style={[styles.badge, { backgroundColor: theme.surface }]}>
            <Text style={[styles.badgeDay, { color: day === today ? theme.danger : theme.muted }]}>{date.toLocaleDateString(undefined, { weekday: 'long' }).toUpperCase()}</Text>
            <Text style={[styles.badgeNum, { color: theme.text }]}>{date.getDate()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: theme.text }]}>{periodTitle(period)}</Text>
            <Text style={{ color: theme.muted }}>
              {day === today ? 'Today' : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · {periodLabel}
            </Text>
          </View>
        </View>

        <View
          // userSelect: stop the web build selecting dial text while dragging (no effect on Android).
          style={[{ height: dialH, marginHorizontal: -12 }, NO_SELECT]}
          accessibilityHint="Drag around the dial to move through the day"
          {...rotation.dialProps}
        >
          <RadialDay
            width={dialW}
            height={dialH}
            items={dialItems}
            dayStart={dayStart}
            baseMin={rotation.baseMin}
            rotation={rotation.rotation}
            hourly={hourly.status === 'ok' ? hourly.hours.map((h) => h.minutes) : null}
            nowMin={nowMin}
          />
          <View style={styles.periods}>
            {day !== today || Math.abs(startMin - windowAround(new Date())) > 30 ? (
              <Pressable
                onPress={() => {
                  setDay(today);
                  animateTo(windowAround(new Date()));
                }}
                accessibilityRole="button"
                accessibilityLabel="Rotate to now"
                style={[styles.periodChip, { backgroundColor: mix(theme.background, theme.danger, 0.16) }]}
              >
                <Text style={{ color: theme.danger, fontWeight: '700', fontSize: 12 }}>Now</Text>
              </Pressable>
            ) : null}
            {PERIODS.map((p) => {
              const on = p.key === period && startMin === p.startHour * 60;
              return (
                <Pressable
                  key={p.key}
                  onPress={() => animateTo(Math.min(p.startHour * 60, 18 * 60))}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${p.label}, ${String(p.startHour).padStart(2, '0')}:00 to ${String(p.startHour + 6).padStart(2, '0')}:00`}
                  style={[styles.periodChip, { backgroundColor: on ? theme.text : theme.raised }]}
                >
                  <Text style={{ color: on ? theme.background : theme.muted, fontWeight: '600', fontSize: 12 }}>{p.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {soonExam ? (
          <Pressable
            onPress={() => router.push({ pathname: '/college/exam/[id]', params: { id: soonExam.exam.id } })}
            accessibilityRole="button"
            style={[styles.banner, { backgroundColor: mix(theme.background, theme.danger, 0.13) }]}
          >
            <Ionicons name="alert-circle" size={18} color={theme.danger} />
            <Text style={{ color: theme.text, flex: 1 }} numberOfLines={2}>
              {soonExam.exam.series} {soonExam.title}: {countdownLabel(soonExam.daysAway).toLowerCase()}
              {soonExam.exam.start ? ` at ${soonExam.exam.start}` : ''}
              {soonExam.clashes.length ? ` · clashes with ${soonExam.clashes.join(', ')}` : ''}
            </Text>
          </Pressable>
        ) : null}
        <CalendarAccessNotice access={calendar.access} onRequest={calendar.requestAccess} />
        <PhoneUseCard data={hourly} startMin={startMin} isToday={day === today} limitMin={settings.screenTimeLimitMin} />

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.cardTitle, { color: theme.muted }]}>TO DO</Text>
            {todos.map(({ todo, overdue }) => (
              <CheckRow
                key={todo.id}
                label={todo.title}
                hint={overdue ? `Task · from ${fromDateKey(todo.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}` : 'Task'}
                done={todo.done}
                danger={overdue}
                onPress={() => toggleTask(todo.id, !todo.done)}
                onLongPress={() => router.push({ pathname: '/task/[id]', params: { id: todo.id } })}
              />
            ))}
            {allDayEvents.map((e) => (
              <Text key={e.id} style={{ color: theme.text, fontWeight: '600' }} numberOfLines={1}>
                <Text style={{ color: theme.primary }}>● </Text>
                {e.title} <Text style={{ color: theme.muted, fontWeight: '400' }}>· all day</Text>
              </Text>
            ))}
            {untimedHabits.map((h) => {
              const isDone = isCompleted(state, h.id, day);
              return <CheckRow key={h.id} label={h.name} hint="Habit" done={isDone} onPress={() => toggle(h.id, day, !isDone)} />;
            })}
            {due.map((a) => (
              <CheckRow key={a.id} label={a.title} hint="Due today" done={a.done} onPress={() => toggleAssignment(a.id)} danger />
            ))}
            {gamedev.map((g) =>
              g.kind === 'jam' ? (
                <Text key={g.key} style={{ color: theme.text, fontWeight: '600' }} numberOfLines={1} onPress={() => router.push('/gamedev/jams')}>
                  <Text style={{ color: theme.accent }}>● </Text>
                  {g.title} <Text style={{ color: theme.muted, fontWeight: '400' }}>· jam starts {fmtTime(new Date(g.start))}</Text>
                </Text>
              ) : (
                <CheckRow
                  key={g.key}
                  label={g.title}
                  hint={`${g.project} · ${g.kind === 'milestone' ? 'milestone' : 'Steam launch'}`}
                  done={g.done}
                  onPress={() =>
                    g.kind === 'milestone'
                      ? projects.toggleMilestone(g.projectId, g.id)
                      : projects.apply((s) => setLaunchItem(s, g.projectId, g.id, { done: !g.done }, Date.now()))
                  }
                />
              ),
            )}
            {!todos.length && !allDayEvents.length && !untimedHabits.length && !due.length && !gamedev.length ? (
              <Text style={{ color: theme.muted }}>Nothing to do yet. Add a task below.</Text>
            ) : null}
            <View style={styles.quickRow}>
              <TextInput
                value={quickTask}
                onChangeText={setQuickTask}
                onSubmitEditing={addQuickTask}
                placeholder="+ Add a task"
                placeholderTextColor={theme.muted}
                accessibilityLabel="Add a task"
                returnKeyType="done"
                style={[styles.quickInput, { color: theme.text, borderColor: theme.border }]}
              />
              <Pressable
                onPress={() => router.push({ pathname: '/task/[id]', params: { id: 'new', date: day } })}
                accessibilityRole="button"
                accessibilityLabel="Add a task with a time"
                hitSlop={8}
              >
                <Ionicons name="time-outline" size={22} color={theme.primary} />
              </Pressable>
            </View>
          </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.muted }]}>{periodTitle(period).replace('Your ', '').toUpperCase()} · {inPeriod.length} ITEM{inPeriod.length === 1 ? '' : 'S'}</Text>
          {inPeriod.length === 0 ? <Text style={{ color: theme.muted }}>Nothing planned. Try another part of the day on the dial.</Text> : null}
          {inPeriod.map((item) => (
            <ItemRow
              key={item.key}
              item={item}
              day={day}
              onPress={() => press(item)}
              onLongPress={item.kind === 'task' ? () => router.push({ pathname: '/task/[id]', params: { id: item.taskId } }) : undefined}
            />
          ))}
        </View>
      </KeyboardScroll>

      <Pressable
        onPress={() => router.push({ pathname: '/add', params: { date: day } })}
        accessibilityRole="button"
        accessibilityLabel="Add"
        style={[styles.fab, { backgroundColor: theme.primary }]}
      >
        <Ionicons name="add" size={30} color={theme.onPrimary} />
      </Pressable>

      <DayRings
        days={week}
        selected={day}
        today={today}
        progress={progress}
        onSelect={(d) => setDay(d)}
        onPrevWeek={() => setDay(addDays(day, -7))}
        onNextWeek={() => setDay(addDays(day, 7))}
      />
    </View>
  );
}

function ItemRow({ item, day, onPress, onLongPress }: { item: TimelineItem; day: DateKey; onPress: () => void; onLongPress?: () => void }) {
  const theme = useTheme();
  const color =
    item.kind === 'class' ? item.color || theme.primary : item.kind === 'course' ? item.color : item.kind === 'exam' ? theme.danger : item.kind === 'event' ? theme.primary : theme.accent;
  const time = item.kind === 'habit' ? fmtTime(item.start) : formatEventTime({ start: item.start, end: item.end, allDay: false }, day, fmtTime);
  const kind =
    item.kind === 'class' ? item.room : item.kind === 'exam' ? 'Exam' : item.kind === 'event' ? item.location || 'Calendar' : item.kind === 'study' ? 'Revision' : item.kind === 'course' ? 'Course' : item.kind === 'habit' ? 'Habit' : item.kind === 'task' ? 'Task' : 'Schedule';
  const done = (item.kind === 'habit' || item.kind === 'study' || item.kind === 'task' || item.kind === 'course') && item.done;
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} accessibilityRole="button" accessibilityLabel={`${item.title}, ${time}, ${kind}${done ? ', done' : ''}`} style={styles.itemRow}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <View style={{ flex: 1 }}>
        <Text style={[{ color: done ? theme.muted : theme.text, fontWeight: '600', fontSize: 15 }, done && styles.strike]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={{ color: theme.muted, fontSize: 12 }} numberOfLines={1}>
          {time} · {kind}
          {item.kind !== 'habit' && item.conflict ? ' · overlaps' : ''}
        </Text>
      </View>
      {item.kind === 'habit' || item.kind === 'study' || item.kind === 'task' || item.kind === 'course' ? <Ionicons name={done ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={done ? theme.accent : theme.muted} /> : null}
    </Pressable>
  );
}

function CheckRow({ label, hint, done, onPress, onLongPress, danger }: { label: string; hint: string; done: boolean; onPress: () => void; onLongPress?: () => void; danger?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} accessibilityRole="checkbox" accessibilityState={{ checked: done }} accessibilityLabel={`${label}, ${hint}`} style={styles.itemRow}>
      <View style={[styles.check, { borderColor: danger ? theme.danger : theme.primary, backgroundColor: done ? (danger ? theme.danger : theme.primary) : 'transparent' }]}>
        {done ? <Ionicons name="checkmark" size={16} color={theme.background} /> : null}
      </View>
      <Text style={[{ flex: 1, color: done ? theme.muted : theme.text, fontSize: 15 }, done && styles.strike]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={{ color: danger && !done ? theme.danger : theme.muted, fontSize: 12 }}>{hint}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 12, paddingBottom: 90, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: { width: 66, height: 66, borderRadius: 33, alignItems: 'center', justifyContent: 'center' },
  badgeDay: { fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  badgeNum: { fontSize: 26, fontWeight: '800', marginTop: -2 },
  title: { fontSize: 26, fontWeight: '800', fontFamily: 'serif' },
  periods: { position: 'absolute', left: 12, top: 8, gap: 6 },
  periodChip: { borderRadius: 9, paddingHorizontal: 10, paddingVertical: 6 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14 },
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 8 },
  cardTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 34 },
  quickRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  quickInput: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 15 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  strike: { textDecorationLine: 'line-through' },
  fab: { position: 'absolute', right: 18, bottom: 74, width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
});
