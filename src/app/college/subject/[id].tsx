import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { LinkList } from '@/components/LinkList';
import { Chip, ChipRow, ErrorText, Field, FormScreen, ScreenHeader, SectionTitle, confirmDestructive } from '@/components/ui';
import { newId, useCollege } from '@/hooks/useCollege';
import { useTheme } from '@/hooks/useTheme';
import { SUBJECT_COLORS, setSubjectLinks } from '@/lib/college';

export default function SubjectFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const c = useCollege();
  const existing = id === 'new' ? undefined : c.college.subjects.find((s) => s.id === id);

  const [name, setName] = useState(existing?.name ?? '');
  const [short, setShort] = useState(existing?.short ?? '');
  const [code, setCode] = useState(existing?.code ?? '');
  const [color, setColor] = useState(existing?.color ?? SUBJECT_COLORS[c.college.subjects.length % SUBJECT_COLORS.length]);
  const [error, setError] = useState<string | null>(null);

  if (id !== 'new' && !existing) {
    return (
      <FormScreen>
        <ScreenHeader title="Subject" modal />
        <Text style={{ color: theme.muted }}>This subject no longer exists.</Text>
      </FormScreen>
    );
  }

  const save = () => {
    if (!name.trim()) return setError('Enter a subject name');
    c.upsertSubject({
      id: existing?.id ?? newId(),
      name: name.trim(),
      short: short.trim() || name.trim().slice(0, 8),
      code: code.trim() || undefined,
      color,
      links: existing?.links,
    });
    router.back();
  };

  return (
    <FormScreen>
      <ScreenHeader title={existing ? 'Edit subject' : 'New subject'} modal />
      <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Engineering Mathematics" maxLength={80} />
      <Field label="Short name" value={short} onChangeText={setShort} placeholder="e.g. Maths" maxLength={12} />
      <Field label="Code" value={code} onChangeText={setCode} placeholder="e.g. MA101" autoCapitalize="characters" maxLength={20} />
      <SectionTitle>Colour</SectionTitle>
      <ChipRow>
        {SUBJECT_COLORS.map((col, i) => (
          <Chip key={col} label={`${i + 1}`} color={col} selected={col === color} onPress={() => setColor(col)} />
        ))}
      </ChipRow>
      {existing ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Button title="Study timer" variant="plain" onPress={() => router.push({ pathname: '/study', params: { subject: existing.id } })} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Flashcards" variant="plain" onPress={() => router.push({ pathname: '/college/cards', params: { subject: existing.id } })} />
          </View>
        </View>
      ) : null}
      <SectionTitle>Links</SectionTitle>
      {existing ? (
        <LinkList
          links={existing.links}
          onChange={(links) => c.apply((st) => setSubjectLinks(st, existing.id, links))}
          emptyText="Drive folders, notes, Classroom, lab manuals… They also show on this subject's classes and exams."
          addHint="Saved straight away. Opens in the Drive / Docs / GitHub app if installed."
        />
      ) : (
        <Text style={{ color: theme.muted }}>Save the subject first, then add links.</Text>
      )}
      <ErrorText>{error}</ErrorText>
      <Button title="Save" onPress={save} />
      {existing ? (
        <Button
          title="Delete subject"
          variant="danger"
          onPress={() =>
            confirmDestructive('Delete subject?', 'Its classes and exams stay, labelled with the old name.', 'Delete', () => {
              c.deleteSubject(existing.id);
              router.back();
            })
          }
        />
      ) : null}
    </FormScreen>
  );
}
