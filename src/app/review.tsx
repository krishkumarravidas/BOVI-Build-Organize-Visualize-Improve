import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { SummaryView } from '@/components/SummaryView';
import { Chip, ChipRow, Field, ScreenHeader, SectionTitle } from '@/components/ui';
import { newId, useCollege } from '@/hooks/useCollege';
import { useHabits } from '@/hooks/useHabits';
import { useProjects } from '@/hooks/useProjects';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { addDays, toDateKey } from '@/lib/dates';
import { dateLabel, thisWeek, upsertItem, weekTasks } from '@/lib/gamedev';
import { summarize, summaryText } from '@/lib/summary';

/** Sunday review: the week in numbers, two reflection prompts, then plan next week. */
export default function ReviewScreen() {
  const theme = useTheme();
  const { college } = useCollege();
  const { state: habitState } = useHabits();
  const p = useProjects();
  const { settings } = useSettings();
  const today = toDateKey(new Date());
  const current = thisWeek(today);
  const [week, setWeek] = useState(current);
  const to = week === current ? today : addDays(week, 6);
  const s = summarize(week, to, { college, habitState, projects: p.state });
  const saved = p.state.reviews?.find((r) => r.week === week);
  const [well, setWell] = useState(saved?.well ?? '');
  const [change, setChange] = useState(saved?.change ?? '');
  const [shownWeek, setShownWeek] = useState(week);
  if (shownWeek !== week) {
    // Switched weeks: load that week's notes.
    setShownWeek(week);
    setWell(saved?.well ?? '');
    setChange(saved?.change ?? '');
  }
  const planned = weekTasks(p.state, week);
  const nextWeek = addDays(week, 7);
  const label = `Week of ${dateLabel(week)}`;

  const saveNotes = () => {
    if (!well.trim() && !change.trim() && !saved) return;
    p.apply((st) => upsertItem(st, 'reviews', { id: saved?.id ?? newId(), week, ...(well.trim() ? { well: well.trim() } : {}), ...(change.trim() ? { change: change.trim() } : {}) }));
  };

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <ScreenHeader title="Weekly review" />
      <ChipRow>
        <Chip label="This week" selected={week === current} onPress={() => setWeek(current)} />
        <Chip label="Last week" selected={week === addDays(current, -7)} onPress={() => setWeek(addDays(current, -7))} />
      </ChipRow>
      <Text style={{ color: theme.muted }}>
        {dateLabel(week)} – {dateLabel(to)}
      </Text>
      <SummaryView s={s} />
      {planned.length ? (
        <Text style={{ color: theme.text }}>
          Planned {settings.projectsTabName.toLowerCase()} tasks: {planned.filter((x) => x.task.done).length} of {planned.length} done.
        </Text>
      ) : null}

      <SectionTitle>Reflect</SectionTitle>
      <Field label="What went well?" value={well} onChangeText={setWell} onBlur={saveNotes} multiline placeholder="e.g. Three evening sessions on my project" />
      <Field label="What will you change next week?" value={change} onChangeText={setChange} onBlur={saveNotes} multiline placeholder="e.g. Start exam revision before Thursday" />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Button title="Share" variant="plain" onPress={() => Share.share({ message: summaryText(label, s, settings.projectsTabName) + (well.trim() ? `\n\nWent well: ${well.trim()}` : '') + (change.trim() ? `\nNext week: ${change.trim()}` : '') }).catch(() => {})} />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title="Plan next week"
            onPress={() => {
              saveNotes();
              router.push({ pathname: '/gamedev/plan', params: { week: week === current ? nextWeek : addDays(current, 7) } });
            }}
          />
        </View>
      </View>
      <Button title="Monthly report" variant="plain" onPress={() => router.push('/report')} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: 16, gap: 12, paddingBottom: 40 } });
