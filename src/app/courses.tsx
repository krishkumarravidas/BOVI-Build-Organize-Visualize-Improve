import { router } from 'expo-router';
import { Fragment, useState } from 'react';
import { Text } from 'react-native';

import { Button } from '@/components/Button';
import { CourseCard } from '@/components/CourseCard';
import { EmptyText, ErrorText, Field, FormScreen, ScreenHeader, SectionTitle } from '@/components/ui';
import { useCourses } from '@/hooks/useCourses';
import { newId } from '@/hooks/useCollege';
import { useTheme } from '@/hooks/useTheme';
import { COURSE_COLORS, newCourse, validateCourse } from '@/lib/courses';
import { toDateKey } from '@/lib/dates';

export default function CoursesScreen() {
  const theme = useTheme();
  const c = useCourses();
  const [now] = useState(() => new Date());
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = () => {
    const today = toDateKey(new Date());
    const err = validateCourse({ title, startedAt: today });
    setError(err);
    if (err) return;
    const id = newId();
    c.add(newCourse(title, id, today, COURSE_COLORS[c.courses.length % COURSE_COLORS.length]));
    setTitle('');
    router.push({ pathname: '/course/[id]', params: { id } });
  };

  const groups = [
    { label: 'Active', list: c.courses.filter((x) => x.status === 'active') },
    { label: 'Paused', list: c.courses.filter((x) => x.status === 'paused') },
    { label: 'Finished', list: c.courses.filter((x) => x.status === 'done') },
  ];

  return (
    <FormScreen>
      <ScreenHeader title="Courses" />
      <Text style={{ color: theme.muted }}>
        Courses you follow on your own: Udemy, YouTube series, a book. Paste the lessons, set weekly study times (they show on the calendar), and BOVI tracks your progress and pace.
      </Text>
      <Field label="New course" value={title} onChangeText={setTitle} placeholder="e.g. Unreal Engine 5 Blueprints" onSubmitEditing={create} returnKeyType="done" />
      <ErrorText>{error}</ErrorText>
      <Button title="Create course" onPress={create} />

      {c.courses.length === 0 ? <EmptyText>No courses yet.</EmptyText> : null}
      {groups.map((g) =>
        g.list.length ? (
          <Fragment key={g.label}>
            <SectionTitle>{`${g.label} · ${g.list.length}`}</SectionTitle>
            {g.list.map((course) => (
              <CourseCard key={course.id} course={course} now={now} />
            ))}
          </Fragment>
        ) : null,
      )}
    </FormScreen>
  );
}
