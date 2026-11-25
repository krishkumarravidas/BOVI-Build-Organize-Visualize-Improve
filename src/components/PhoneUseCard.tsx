/**
 * Phone use for the hours the dial is showing: what the dial's outer ring means, in numbers.
 * Colours match the ring (light / 15–30 min / 30+ min) and are always paired with text.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { HourlyScreenTime } from '@/hooks/useHourlyScreenTime';
import { useTheme } from '@/hooks/useTheme';
import { formatDuration, hourLabel, limitStatus, usageLevel, windowUsage, type UsageLevel } from '@/lib/screentime';
import { radius } from '@/theme/colors';

const BAR_H = 64;
const min = (m: number) => formatDuration(m * 60_000);

export function useUsageColor() {
  const theme = useTheme();
  return (level: UsageLevel) => (level === 'heavy' ? theme.danger : level === 'medium' ? theme.warn : theme.muted);
}

export function PhoneUseCard({ data, startMin, isToday, limitMin }: { data: HourlyScreenTime; startMin: number; isToday: boolean; limitMin: number | null }) {
  const theme = useTheme();
  const color = useUsageColor();
  const startHour = Math.floor(startMin / 60);
  const [picked, setPicked] = useState<{ window: number; hour: number } | null>(null);

  if (data.status === 'unavailable') return null;
  if (data.status === 'no-access') {
    return (
      <Pressable onPress={() => router.push('/screen-time')} accessibilityRole="button" style={[styles.card, styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Ionicons name="phone-portrait-outline" size={20} color={theme.muted} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text, fontWeight: '600' }}>See your phone use on the dial</Text>
          <Text style={{ color: theme.muted, fontSize: 13 }}>Turn on Usage access and the outer ring shows how much you used your phone each hour.</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.muted} />
      </Pressable>
    );
  }

  const w = windowUsage(data.hours, startHour, 6);
  if (!w.hours.length) return null;
  const dayTotal = data.hours.reduce((a, h) => a + h.minutes, 0);
  const limit = isToday ? limitStatus(dayTotal * 60_000, limitMin) : null;
  // The picked bar only sticks while the dial stays on the same window.
  const selHour = picked && picked.window === startHour ? picked.hour : w.busiest?.hour ?? null;
  const sel = w.hours.find((h) => h.hour === selHour);
  const first = w.hours[0].hour;
  const last = w.hours[w.hours.length - 1].hour + 1;

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.head}>
        <Text style={[styles.overline, { color: theme.muted }]}>
          PHONE USE · {hourLabel(first)}–{hourLabel(last)}
        </Text>
        <Text style={[styles.total, { color: theme.text }]}>{w.totalMin ? min(w.totalMin) : 'None'}</Text>
      </View>
      <Text style={{ color: limit?.over ? theme.danger : theme.muted, fontSize: 13 }}>
        {isToday ? 'Today' : 'That day'} {min(dayTotal)}
        {limit ? (limit.over ? ` · over your ${min(limitMin!)} limit` : ` · ${formatDuration(limit.remainingMs)} left of ${min(limitMin!)}`) : ''}
        {w.heavyHours ? ` · ${w.heavyHours} heavy ${w.heavyHours === 1 ? 'hour' : 'hours'} here` : ''}
      </Text>

      {/* Hour bars */}
      <View style={styles.bars}>
        {w.hours.map((h) => {
          const level = usageLevel(h.minutes);
          const on = h.hour === selHour;
          return (
            <Pressable
              key={h.hour}
              onPress={() => setPicked({ window: startHour, hour: h.hour })}
              style={styles.barCol}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${hourLabel(h.hour)}: ${h.minutes ? `${h.minutes} minutes` : 'no phone use'}`}
            >
              <Text style={[styles.barValue, { color: on ? theme.text : theme.muted }]}>{h.minutes ? `${h.minutes}m` : ''}</Text>
              <View style={[styles.barTrack, { backgroundColor: theme.raised }]}>
                <View style={{ height: Math.max(h.minutes ? 3 : 0, (h.minutes / 60) * BAR_H), backgroundColor: color(level), borderRadius: 4, opacity: on || selHour === null ? 1 : 0.55 }} />
              </View>
              <Text style={[styles.barHour, { color: on ? theme.text : theme.muted, fontWeight: on ? '700' : '500' }]}>{hourLabel(h.hour).replace(' ', '').toLowerCase()}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Selected hour */}
      {sel && sel.minutes ? (
        <Text style={{ color: theme.text }} accessibilityLiveRegion="polite">
          <Text style={{ fontWeight: '700' }}>
            {hourLabel(sel.hour)}–{hourLabel(sel.hour + 1)}
            {sel.hour === w.busiest?.hour ? ' (busiest)' : ''}:{' '}
          </Text>
          {min(sel.minutes)}
          {sel.top.length ? ` · ${sel.top.map((a) => `${a.label} ${formatDuration(a.foregroundMs)}`).join(', ')}` : ''}
        </Text>
      ) : (
        <Text style={{ color: theme.muted }}>{w.totalMin ? 'Tap an hour to see which apps.' : 'No phone use in these hours.'}</Text>
      )}
      {w.topApps.length > 1 ? (
        <Text style={{ color: theme.muted, fontSize: 13 }}>Most used here: {w.topApps.map((a) => `${a.label} ${formatDuration(a.foregroundMs)}`).join(' · ')}</Text>
      ) : null}

      {/* Legend: explains the dial's outer ring */}
      <View style={styles.legend}>
        <Text style={{ color: theme.muted, fontSize: 12 }}>Outer ring of the dial:</Text>
        {(['light', 'medium', 'heavy'] as const).map((l) => (
          <View key={l} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: color(l) }]} />
            <Text style={{ color: theme.muted, fontSize: 12 }}>{l === 'light' ? 'under 15m' : l === 'medium' ? '15–30m' : '30m+'}</Text>
          </View>
        ))}
      </View>

      <Pressable onPress={() => router.push('/screen-time')} accessibilityRole="button" style={styles.more} hitSlop={8}>
        <Text style={{ color: theme.text, fontWeight: '600' }}>All screen time</Text>
        <Ionicons name="chevron-forward" size={16} color={theme.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  overline: { fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  total: { fontSize: 20, fontWeight: '800' },
  bars: { flexDirection: 'row', gap: 8, marginTop: 4 },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  barValue: { fontSize: 11, fontWeight: '600', height: 14 },
  barTrack: { width: '100%', height: BAR_H, borderRadius: 4, justifyContent: 'flex-end', overflow: 'hidden' },
  barHour: { fontSize: 11 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  more: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start' },
});
