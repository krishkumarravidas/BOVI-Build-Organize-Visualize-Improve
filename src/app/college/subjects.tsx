import { router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { Button } from '@/components/Button';
import { Card, EmptyText, Field, ListRow, ScreenHeader, SectionTitle } from '@/components/ui';
import { useCollege } from '@/hooks/useCollege';
import { useTheme } from '@/hooks/useTheme';

export default function SubjectsScreen() {
  const theme = useTheme();
  const c = useCollege();
  const { college } = c;

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <ScreenHeader title="Subjects" />
      <Card>
        <Field label="Course" value={college.profile} onChangeText={(v) => c.setProfile({ profile: v })} placeholder="e.g. B.Tech CSE · Sem 3 · Section A" />
        <Field label="Default classroom" value={college.defaultRoom} onChangeText={(v) => c.setProfile({ defaultRoom: v })} placeholder="e.g. Room 204" />
      </Card>
      <SectionTitle>{`${college.subjects.length} subjects`}</SectionTitle>
      {college.subjects.length === 0 ? <EmptyText>No subjects yet.</EmptyText> : null}
      {college.subjects.map((s) => {
        const weekly = college.slots.filter((x) => x.subjectId === s.id).length;
        return (
          <ListRow
            key={s.id}
            title={s.name}
            subtitle={`${s.short}${s.code ? ` · ${s.code}` : ''} · ${weekly} class${weekly === 1 ? '' : 'es'}/week${s.links?.length ? ` · ${s.links.length} link${s.links.length === 1 ? '' : 's'}` : ''}`}
            color={s.color}
            hint="Edit subject"
            onPress={() => router.push({ pathname: '/college/subject/[id]', params: { id: s.id } })}
          />
        );
      })}
      <Button title="Add subject" onPress={() => router.push({ pathname: '/college/subject/[id]', params: { id: 'new' } })} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: 16, gap: 10, paddingBottom: 40 } });
