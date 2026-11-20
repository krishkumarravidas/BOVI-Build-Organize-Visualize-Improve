import { useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { SummaryView } from '@/components/SummaryView';
import { ScreenHeader } from '@/components/ui';
import { useCollege } from '@/hooks/useCollege';
import { useHabits } from '@/hooks/useHabits';
import { useProjects } from '@/hooks/useProjects';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { toDateKey } from '@/lib/dates';
import { monthLabel, monthRange, summarize, summaryText } from '@/lib/summary';

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const shift = (month: string, delta: number) => {
  const [y, m] = month.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
};

/** A month in one card, ready to share. */
export default function ReportScreen() {
  const theme = useTheme();
  const { college } = useCollege();
  const { state: habitState } = useHabits();
  const p = useProjects();
  const { settings } = useSettings();
  const thisMonth = monthKey(new Date());
  const [month, setMonth] = useState(thisMonth);
  const range = monthRange(month);
  const today = toDateKey(new Date());
  const to = month === thisMonth ? today : range.to;
  const s = summarize(range.from, to, { college, habitState, projects: p.state });
  const label = monthLabel(month) + (month === thisMonth ? ' (so far)' : '');

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      <ScreenHeader title="Monthly report" />
      <View style={styles.row}>
        <Button title="‹" variant="plain" onPress={() => setMonth(shift(month, -1))} />
        <Text style={{ color: theme.text, fontWeight: '800', fontSize: 18, flex: 1, textAlign: 'center' }}>{label}</Text>
        <Button title="›" variant="plain" onPress={() => setMonth(shift(month, 1))} disabled={month >= thisMonth} />
      </View>
      <SummaryView s={s} />
      <Button title="Share report" onPress={() => Share.share({ message: summaryText(label, s, settings.projectsTabName), title: `BOVI · ${label}` }).catch(() => {})} />
      <Text style={{ color: theme.muted, fontSize: 12 }}>Shares as text. Take a screenshot of this screen if you want the card look.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
