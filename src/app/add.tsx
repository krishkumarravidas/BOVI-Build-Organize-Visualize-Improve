import { router, useLocalSearchParams } from 'expo-router';

import { FormScreen, ListRow, ScreenHeader } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { toDateKey } from '@/lib/dates';

/** Quick-add menu opened from the calendar's + button. */
export default function AddScreen() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  const theme = useTheme();
  const day = date ?? toDateKey(new Date());
  const go = (href: Parameters<typeof router.replace>[0]) => router.replace(href);

  return (
    <FormScreen>
      <ScreenHeader title="Add" modal />
      <ListRow title="Task" subtitle="A one-off thing to do on this day, with an optional time" color={theme.primary} onPress={() => go({ pathname: '/task/[id]', params: { id: 'new', date: day } })} />
      <ListRow title="Habit" subtitle="Something to do regularly" onPress={() => go({ pathname: '/habit/[id]', params: { id: 'new' } })} />
      <ListRow title="Class on this day" subtitle="Extra lecture, rescheduled lab…" color={theme.accent} onPress={() => go({ pathname: '/college/extra', params: { date: day } })} />
      <ListRow title="Assignment" subtitle="With a due date and reminder" color={theme.danger} onPress={() => go({ pathname: '/college/assignment/[id]', params: { id: 'new' } })} />
      <ListRow title="Exam" subtitle="IA, SEE, quiz…" color={theme.danger} onPress={() => go({ pathname: '/college/exam/[id]', params: { id: 'new' } })} />
      <ListRow title="Schedule block" subtitle="Recurring time like gym or sleep" color={theme.accent} onPress={() => go({ pathname: '/schedule/[id]', params: { id: 'new' } })} />
      <ListRow title="Project" subtitle="Game dev or side project" onPress={() => go({ pathname: '/project/[id]', params: { id: 'new' } })} />
      <ListRow title="Devlog entry" subtitle="What you did today" onPress={() => go('/devlog')} />
      <ListRow title="Idea" subtitle="Park it in the inbox" onPress={() => go('/ideas')} />
    </FormScreen>
  );
}
