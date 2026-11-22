/**
 * Pieces of the attendance screen. Present vs absent is never told by colour alone: present is a
 * filled shape, absent an outlined (hollow) one, unmarked dashed, and every view has a legend or text.
 */
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

import { useTheme } from '@/hooks/useTheme';
import { dayState, monthGrid, type ClassStatus, type DayState, type DaySummary, type HistoryStats } from '@/lib/attendanceHistory';
import type { DateKey } from '@/lib/types';
import { radius } from '@/theme/colors';
import { readableOn } from '@/theme/contrast';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEK = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const dayName = (d: number) => DAY_NAMES[d];
const shortDay = (key: DateKey) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

// ---------- ring ----------

/** Percentage ring with a tick at the target. */
export function AttendanceRing({ percent, target, size = 112 }: { percent: number | null; target: number; size?: number }) {
  const theme = useTheme();
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  const p = percent === null ? 0 : Math.max(0, Math.min(100, percent));
  const low = percent !== null && percent < target;
  const a = ((target / 100) * 360 - 90) * (Math.PI / 180);
  return (
    <View style={{ width: size, height: size }} accessibilityLabel={percent === null ? 'No attendance yet' : `${Math.round(p)} percent, target ${target}`}>
      <Svg width={size} height={size}>
        <Circle cx={c} cy={c} r={r} stroke={theme.raised} strokeWidth={stroke} fill="none" />
        {percent !== null ? (
          <Circle
            cx={c}
            cy={c}
            r={r}
            stroke={low ? theme.danger : theme.text}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${(p / 100) * circ} ${circ}`}
            transform={`rotate(-90 ${c} ${c})`}
          />
        ) : null}
        <Line x1={c + (r - stroke) * Math.cos(a)} y1={c + (r - stroke) * Math.sin(a)} x2={c + (r + stroke) * Math.cos(a)} y2={c + (r + stroke) * Math.sin(a)} stroke={theme.muted} strokeWidth={2} strokeLinecap="round" />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.ringCenter]}>
        <Text style={[styles.ringPct, { color: low ? theme.danger : theme.text }]}>{percent === null ? '—' : `${Math.round(p)}%`}</Text>
        <Text style={{ color: theme.muted, fontSize: 11 }}>target {target}%</Text>
      </View>
    </View>
  );
}

// ---------- stat tiles ----------

export function StatTile({ label, value, detail, tone }: { label: string; value: string; detail?: string; tone?: 'danger' }) {
  const theme = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.tileLabel, { color: theme.muted }]}>{label}</Text>
      <Text style={[styles.tileValue, { color: tone === 'danger' ? theme.danger : theme.text }]} numberOfLines={1}>
        {value}
      </Text>
      {detail ? (
        <Text style={{ color: theme.muted, fontSize: 12 }} numberOfLines={2}>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

// ---------- month calendar ----------

function useCellStyle() {
  const theme = useTheme();
  return (state: DayState) => {
    switch (state) {
      case 'present':
        return { box: { backgroundColor: theme.accent, borderColor: theme.accent }, text: readableOn(theme.accent) };
      case 'mixed':
        return { box: { backgroundColor: theme.accent, borderColor: theme.danger, borderWidth: 2.5 }, text: readableOn(theme.accent) };
      case 'absent':
        return { box: { backgroundColor: 'transparent', borderColor: theme.danger, borderWidth: 2.5 }, text: theme.danger };
      case 'unmarked':
        return { box: { backgroundColor: 'transparent', borderColor: theme.muted, borderStyle: 'dashed' as const, borderWidth: 1.5 }, text: theme.text };
      default:
        return { box: { backgroundColor: 'transparent', borderColor: 'transparent' }, text: theme.muted };
    }
  };
}

const STATE_LABEL: Record<DayState, string> = { present: 'all present', absent: 'absent', mixed: 'some missed', unmarked: 'not marked', none: 'no classes' };

export function MonthCalendar({
  year,
  month,
  days,
  upcoming,
  today,
  selected,
  onSelect,
  onMonth,
  canGoBack,
}: {
  year: number;
  month: number;
  days: Map<DateKey, DaySummary>;
  /** Future days that have classes (shown with a dot). */
  upcoming: Set<DateKey>;
  today: DateKey;
  selected: DateKey | null;
  onSelect: (d: DateKey) => void;
  onMonth: (delta: number) => void;
  canGoBack: boolean;
}) {
  const theme = useTheme();
  const cell = useCellStyle();
  const isCurrent = today.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`);
  return (
    <View style={{ gap: 10 }}>
      <View style={styles.calHead}>
        <Pressable onPress={() => onMonth(-1)} disabled={!canGoBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Previous month" style={{ opacity: canGoBack ? 1 : 0.3 }}>
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </Pressable>
        <Text style={[styles.calTitle, { color: theme.text }]}>
          {MONTHS[month]} {year}
        </Text>
        <Pressable onPress={() => onMonth(1)} disabled={isCurrent} hitSlop={12} accessibilityRole="button" accessibilityLabel="Next month" style={{ opacity: isCurrent ? 0.3 : 1 }}>
          <Ionicons name="chevron-forward" size={22} color={theme.text} />
        </Pressable>
      </View>
      <View style={styles.weekRow}>
        {WEEK.map((w, i) => (
          <Text key={i} style={[styles.weekDay, { color: theme.muted }]}>
            {w}
          </Text>
        ))}
      </View>
      {monthGrid(year, month).map((row, ri) => (
        <View key={ri} style={styles.weekRow}>
          {row.map((d, ci) => {
            if (!d) return <View key={ci} style={styles.cellWrap} />;
            const state = dayState(days.get(d));
            const st = cell(state);
            const future = d > today;
            const isSel = selected === d;
            const n = Number(d.slice(8));
            return (
              <Pressable
                key={ci}
                onPress={() => onSelect(d)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSel }}
                accessibilityLabel={`${shortDay(d)}: ${future ? (upcoming.has(d) ? 'classes coming up' : 'no classes') : STATE_LABEL[state]}`}
                style={[styles.cellWrap, isSel && { borderColor: theme.text, borderWidth: 2, borderRadius: radius.sm + 2 }]}
              >
                <View style={[styles.cell, st.box, future && { opacity: 0.55 }]}>
                  <Text style={[styles.cellText, { color: st.text }, d === today && styles.today]}>{n}</Text>
                  {future && upcoming.has(d) ? <View style={[styles.futureDot, { backgroundColor: theme.muted }]} /> : null}
                  {d === today ? <View style={[styles.todayBar, { backgroundColor: st.text }]} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
      <View style={styles.legend}>
        <LegendItem state="present" label="Present" />
        <LegendItem state="absent" label="Absent" />
        <LegendItem state="mixed" label="Some missed" />
        <LegendItem state="unmarked" label="Not marked" />
      </View>
    </View>
  );
}

function LegendItem({ state, label }: { state: DayState; label: string }) {
  const theme = useTheme();
  const st = useCellStyle()(state);
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, st.box]} />
      <Text style={{ color: theme.muted, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

// ---------- weekly trend ----------

export function TrendBars({ weeks, target }: { weeks: HistoryStats['weeks']; target: number }) {
  const theme = useTheme();
  const [picked, setPicked] = useState<number | null>(null);
  const latest = weeks.reduce<number | null>((acc, w, i) => (w.total > 0 ? i : acc), null);
  const sel = picked ?? latest;
  const setSel = setPicked;
  const H = 110;
  const w = sel !== null ? weeks[sel] : null;
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: theme.muted, fontSize: 13 }} accessibilityLiveRegion="polite">
        {w && w.total ? `Week of ${shortDay(w.start)}: ${Math.round(w.percent ?? 0)}% (${w.present} of ${w.total} classes)` : 'Tap a week to see it'}
      </Text>
      <View style={{ height: H, flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
        <View style={[styles.targetLine, { bottom: (target / 100) * H, borderColor: theme.muted }]} pointerEvents="none" />
        {weeks.map((wk, i) => {
          const low = wk.percent !== null && wk.percent < target;
          const h = wk.percent === null ? 0 : Math.max(4, (wk.percent / 100) * H);
          return (
            <Pressable
              key={wk.start}
              onPress={() => setSel(i)}
              style={{ flex: 1, height: H, justifyContent: 'flex-end' }}
              accessibilityRole="button"
              accessibilityLabel={wk.total ? `Week of ${shortDay(wk.start)}, ${Math.round(wk.percent ?? 0)} percent` : `Week of ${shortDay(wk.start)}, no classes`}
            >
              {wk.total ? (
                <View style={{ height: h, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: low ? theme.danger : theme.text, opacity: sel === null || sel === i ? 1 : 0.45 }} />
              ) : (
                <View style={{ height: 2, backgroundColor: theme.border }} />
              )}
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: theme.muted, fontSize: 11 }}>{shortDay(weeks[0].start)}</Text>
        <Text style={{ color: theme.muted, fontSize: 11 }}>- - target {target}%</Text>
        <Text style={{ color: theme.muted, fontSize: 11 }}>this week</Text>
      </View>
    </View>
  );
}

// ---------- per-class dots ----------

/** Last classes as dots: filled = present, hollow = absent, small = not marked. Oldest left. */
export function HistoryDots({ statuses }: { statuses: ClassStatus[] }) {
  const theme = useTheme();
  if (!statuses.length) return null;
  return (
    <View style={styles.dots} accessibilityLabel={`Last ${statuses.length} classes: ${statuses.filter((s) => s === 'present').length} present, ${statuses.filter((s) => s === 'absent').length} absent`}>
      {statuses.map((s, i) =>
        s === 'present' ? (
          <View key={i} style={[styles.dot, { backgroundColor: theme.accent }]} />
        ) : s === 'absent' ? (
          <View key={i} style={[styles.dot, { borderWidth: 2, borderColor: theme.danger }]} />
        ) : (
          <View key={i} style={[styles.dot, { borderWidth: 1, borderColor: theme.muted, borderStyle: 'dashed' }]} />
        ),
      )}
    </View>
  );
}

/** Progress towards the target, with a tick at the target. */
export function TargetBar({ percent, target, color }: { percent: number | null; target: number; color: string }) {
  const theme = useTheme();
  const low = percent !== null && percent < target;
  return (
    <View style={[styles.track, { backgroundColor: theme.raised }]}>
      <View style={{ width: `${Math.max(0, Math.min(100, percent ?? 0))}%`, height: '100%', borderRadius: 4, backgroundColor: low ? theme.danger : color }} />
      <View style={[styles.tick, { left: `${target}%`, backgroundColor: theme.text }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  ringCenter: { alignItems: 'center', justifyContent: 'center' },
  ringPct: { fontSize: 26, fontWeight: '800' },
  tile: { flex: 1, minWidth: '45%', padding: 12, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, gap: 2 },
  tileLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  tileValue: { fontSize: 22, fontWeight: '800' },
  calHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calTitle: { fontSize: 17, fontWeight: '700' },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  weekDay: { width: 42, textAlign: 'center', fontSize: 12, fontWeight: '600' },
  cellWrap: { width: 42, height: 42, padding: 2, borderWidth: 2, borderColor: 'transparent' },
  cell: { flex: 1, borderRadius: radius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cellText: { fontSize: 14, fontWeight: '600' },
  today: { fontWeight: '900' },
  todayBar: { position: 'absolute', bottom: 4, width: 12, height: 2, borderRadius: 1 },
  futureDot: { position: 'absolute', bottom: 4, width: 4, height: 4, borderRadius: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 14, height: 14, borderRadius: 4, borderWidth: 1 },
  targetLine: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1, borderStyle: 'dashed' },
  dots: { flexDirection: 'row', gap: 5, flexWrap: 'wrap' },
  dot: { width: 11, height: 11, borderRadius: 6 },
  track: { height: 8, borderRadius: 4, overflow: 'visible', justifyContent: 'center' },
  tick: { position: 'absolute', width: 2, height: 14, top: -3, borderRadius: 1 },
});
