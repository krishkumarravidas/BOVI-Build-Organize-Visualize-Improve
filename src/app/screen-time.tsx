import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScreenHeader } from '@/components/ui';
import { Button } from '@/components/Button';
import { useScreenTime } from '@/hooks/useScreenTime';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { fromDateKey } from '@/lib/dates';
import { formatDuration, limitStatus, summarizeUsage } from '@/lib/screentime';
import { openUsageAccessSettings } from '../../modules/screen-time';

const LIMITS: { label: string; min: number | null }[] = [
  { label: 'Off', min: null },
  { label: '1h', min: 60 },
  { label: '2h', min: 120 },
  { label: '3h', min: 180 },
  { label: '4h', min: 240 },
  { label: '6h', min: 360 },
];
const CHART_HEIGHT = 96;

export default function ScreenTimeScreen() {
  const theme = useTheme();
  const usage = useScreenTime();
  const { settings, update } = useSettings();

  const card = [styles.card, { backgroundColor: theme.surface, borderColor: theme.border }];
  const header = <ScreenHeader title="Screen time" />;

  if (usage.status === 'unavailable') {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, paddingTop: 16 }]}>
        {header}
        <View style={card}>
          <Text style={{ color: theme.muted }}>
            {Platform.OS === 'android'
              ? 'This build of the app doesn’t include screen time yet. Rebuild and reinstall it to enable it.'
              : 'Screen time is only available in the Android app.'}
          </Text>
        </View>
      </View>
    );
  }

  if (usage.status === 'no-access') {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, paddingTop: 16 }]}>
        {header}
        <View style={card}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Allow usage access</Text>
          <Text style={{ color: theme.muted }}>
            Android only shares app usage with apps you approve. It stays on this phone.
          </Text>
          <Text style={{ color: theme.text }}>
            1. Tap the button below{'\n'}2. Find BOVI in the list{'\n'}3. Turn on “Permit usage access”
            {'\n'}4. Come back here
          </Text>
          <Button title="Open Usage access settings" onPress={openUsageAccessSettings} />
        </View>
      </View>
    );
  }

  const summary = summarizeUsage(usage.today, 5);
  const limit = limitStatus(summary.totalMs, settings.screenTimeLimitMin);
  const maxApp = summary.top[0]?.foregroundMs ?? 1;
  const maxDay = Math.max(1, ...usage.week.map((d) => d.totalMs), (settings.screenTimeLimitMin ?? 0) * 60_000);
  const todayKey = usage.week[usage.week.length - 1]?.day;

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingTop: 16 }]}
      refreshControl={
        <RefreshControl refreshing={usage.status === 'loading'} onRefresh={usage.reload} tintColor={theme.primary} />
      }
    >
      {header}
      {usage.error ? <Text style={{ color: theme.danger }}>{usage.error}</Text> : null}

      <View style={card}>
        <Text style={{ color: theme.muted, fontWeight: '600' }}>TODAY</Text>
        <Text style={[styles.total, { color: theme.text }]} accessibilityLabel={`Today ${formatDuration(summary.totalMs)}`}>
          {usage.status === 'loading' && usage.today.length === 0 ? '—' : formatDuration(summary.totalMs)}
        </Text>
        {limit ? (
          <>
            <View style={[styles.track, { backgroundColor: theme.border }]}>
              <View
                style={[
                  styles.fill,
                  { width: `${Math.min(100, limit.ratio * 100)}%`, backgroundColor: limit.over ? theme.danger : theme.primary },
                ]}
              />
            </View>
            <Text style={{ color: limit.over ? theme.danger : theme.muted, fontWeight: limit.over ? '700' : '400' }}>
              {limit.over
                ? `Over your ${formatDuration(settings.screenTimeLimitMin! * 60_000)} limit`
                : `${formatDuration(limit.remainingMs)} left of ${formatDuration(settings.screenTimeLimitMin! * 60_000)}`}
            </Text>
          </>
        ) : null}
      </View>

      <Text style={[styles.section, { color: theme.muted }]}>Daily limit</Text>
      <View style={styles.chips}>
        {LIMITS.map((l) => {
          const on = settings.screenTimeLimitMin === l.min;
          return (
            <Pressable
              key={l.label}
              onPress={() => update({ screenTimeLimitMin: l.min })}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={l.min ? `Limit ${l.label}` : 'No limit'}
              style={[styles.chip, { borderColor: theme.primary, backgroundColor: on ? theme.primary : 'transparent' }]}
            >
              <Text style={{ color: on ? theme.onPrimary : theme.text, fontWeight: '600' }}>{l.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.section, { color: theme.muted }]}>Top apps today</Text>
      <View style={card}>
        {summary.top.length === 0 ? (
          <Text style={{ color: theme.muted }}>No app usage recorded yet today.</Text>
        ) : (
          summary.top.map((app) => (
            <View key={app.packageName} style={styles.appRow} accessible accessibilityLabel={`${app.label}, ${formatDuration(app.foregroundMs)}`}>
              <View style={styles.appText}>
                <Text style={[styles.appName, { color: theme.text }]} numberOfLines={1}>
                  {app.label}
                </Text>
                <Text style={{ color: theme.muted }}>{formatDuration(app.foregroundMs)}</Text>
              </View>
              <View style={[styles.appTrack, { backgroundColor: theme.border }]}>
                <View style={[styles.fill, { width: `${(app.foregroundMs / maxApp) * 100}%`, backgroundColor: theme.primary }]} />
              </View>
            </View>
          ))
        )}
        {summary.otherCount > 0 ? (
          <Text style={{ color: theme.muted }}>
            {summary.otherCount} other app{summary.otherCount === 1 ? '' : 's'} · {formatDuration(summary.otherMs)}
          </Text>
        ) : null}
      </View>

      <Text style={[styles.section, { color: theme.muted }]}>Last 7 days</Text>
      <View style={card}>
        <View style={styles.bars}>
          {usage.week.map((d) => {
            const over = settings.screenTimeLimitMin != null && d.totalMs >= settings.screenTimeLimitMin * 60_000;
            return (
              <View key={d.day} style={styles.barCol} accessible accessibilityLabel={`${d.day}: ${formatDuration(d.totalMs)}`}>
                <Text style={[styles.barValue, { color: theme.muted }]}>{d.totalMs > 0 ? formatDuration(d.totalMs) : ''}</Text>
                <View style={[styles.barTrack, { backgroundColor: theme.border }]}>
                  <View
                    style={[
                      styles.barFill,
                      { height: (d.totalMs / maxDay) * CHART_HEIGHT, backgroundColor: over ? theme.danger : theme.primary },
                    ]}
                  />
                </View>
                <Text style={{ color: d.day === todayKey ? theme.text : theme.muted, fontWeight: '600' }}>
                  {fromDateKey(d.day).toLocaleDateString(undefined, { weekday: 'narrow' })}
                </Text>
              </View>
            );
          })}
        </View>
        <Text style={{ color: theme.muted, fontSize: 12 }}>
          Android keeps detailed usage for about a week; older days may show less.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, gap: 12 },
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 10 },
  title: { fontSize: 34, fontWeight: '800', marginBottom: 6 },
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 10 },
  cardTitle: { fontSize: 18, fontWeight: '700' },
  total: { fontSize: 44, fontWeight: '800' },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
  section: { fontSize: 14, fontWeight: '700', textTransform: 'uppercase', marginTop: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 2, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, minWidth: 52, alignItems: 'center' },
  appRow: { gap: 6 },
  appText: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  appName: { fontSize: 16, fontWeight: '600', flex: 1 },
  appTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  bars: { flexDirection: 'row', justifyContent: 'space-between' },
  barCol: { alignItems: 'center', gap: 6, flex: 1 },
  barValue: { fontSize: 10, height: 14 },
  barTrack: { width: 20, height: CHART_HEIGHT, borderRadius: 10, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', borderRadius: 10 },
});
