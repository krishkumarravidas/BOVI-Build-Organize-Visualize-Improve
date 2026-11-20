import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { ErrorText, Field, confirmDestructive } from '@/components/ui';
import { newId } from '@/hooks/useCollege';
import { useTheme } from '@/hooks/useTheme';
import { addLink, displayUrl, linkInfo, removeLink, validateLink, type ResourceLink } from '@/lib/links';

/** Opens a link in its app when installed (GitHub, Drive, Docs, YouTube…), otherwise the browser. */
export function openLink(url: string) {
  Linking.openURL(url).catch(() => {});
}

/**
 * A subject's or project's links. Tap to open, long-press to share, ✕ to remove.
 * Without `onChange` the list is read-only (e.g. a subject's links shown on a class).
 */
export function LinkList({
  links,
  onChange,
  emptyText,
  addHint,
}: {
  links: readonly ResourceLink[] | undefined;
  onChange?: (links: ResourceLink[]) => void;
  emptyText?: string;
  addHint?: string;
}) {
  const theme = useTheme();
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const list = links ?? [];

  const add = () => {
    if (!onChange) return;
    const result = validateLink({ url, title });
    if ('error' in result) return setError(result.error);
    onChange(addLink(list, { id: newId(), ...result }));
    setUrl('');
    setTitle('');
    setError(null);
    setAdding(false);
  };

  return (
    <View style={styles.wrap}>
      {list.length === 0 && emptyText ? <Text style={{ color: theme.muted }}>{emptyText}</Text> : null}
      {list.map((l) => {
        const info = linkInfo(l.url);
        return (
          <Pressable
            key={l.id}
            onPress={() => openLink(l.url)}
            onLongPress={() => Share.share({ message: l.url, title: l.title }).catch(() => {})}
            accessibilityRole="link"
            accessibilityLabel={`${l.title}, ${info.label}`}
            accessibilityHint="Opens the link. Long-press to share."
            style={({ pressed }) => [styles.row, { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}
          >
            <View style={[styles.icon, { backgroundColor: theme.background }]}>
              <Ionicons name={info.icon as keyof typeof Ionicons.glyphMap} size={20} color={info.color ?? theme.text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
                {l.title}
              </Text>
              <Text style={{ color: theme.muted, fontSize: 12 }} numberOfLines={1}>
                {info.kind === 'web' ? displayUrl(l.url) : `${info.label} · ${displayUrl(l.url)}`}
              </Text>
            </View>
            {onChange ? (
              <Pressable
                onPress={() => confirmDestructive('Remove link?', l.title, 'Remove', () => onChange(removeLink(list, l.id)))}
                accessibilityRole="button"
                accessibilityLabel={`Remove link ${l.title}`}
                hitSlop={10}
              >
                <Ionicons name="close" size={18} color={theme.muted} />
              </Pressable>
            ) : (
              <Ionicons name="open-outline" size={16} color={theme.muted} />
            )}
          </Pressable>
        );
      })}
      {onChange && adding ? (
        <View style={[styles.form, { borderColor: theme.border }]}>
          <Field
            label="Link"
            value={url}
            onChangeText={(v) => {
              setUrl(v);
              setError(null);
            }}
            placeholder="Paste a GitHub, Drive, Docs… link"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            autoFocus
            onSubmitEditing={add}
            hint={addHint}
          />
          <Field label="Title (optional)" value={title} onChangeText={setTitle} placeholder="e.g. Lab manual, Unit 3 notes" maxLength={60} onSubmitEditing={add} />
          <ErrorText>{error}</ErrorText>
          <View style={styles.buttons}>
            <View style={{ flex: 1 }}>
              <Button title="Cancel" variant="plain" onPress={() => setAdding(false)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="Add link" onPress={add} disabled={!url.trim()} />
            </View>
          </View>
        </View>
      ) : null}
      {onChange && !adding ? <Button title="+ Add link" variant="plain" onPress={() => setAdding(true)} /> : null}
    </View>
  );
}

/** Compact one-tap pills (icon + title) for cards, e.g. the active project's repo and Drive folder. */
export function LinkChips({ links }: { links: readonly ResourceLink[] | undefined }) {
  const theme = useTheme();
  if (!links?.length) return null;
  return (
    <View style={styles.chips}>
      {links.map((l) => {
        const info = linkInfo(l.url);
        return (
          <Pressable
            key={l.id}
            onPress={() => openLink(l.url)}
            onLongPress={() => Share.share({ message: l.url, title: l.title }).catch(() => {})}
            accessibilityRole="link"
            accessibilityLabel={`Open ${l.title}`}
            hitSlop={4}
            style={({ pressed }) => [styles.chip, { borderColor: theme.border, backgroundColor: theme.background, opacity: pressed ? 0.7 : 1 }]}
          >
            <Ionicons name={info.icon as keyof typeof Ionicons.glyphMap} size={15} color={info.color ?? theme.text} />
            <Text style={{ color: theme.text, fontSize: 13, fontWeight: '600', maxWidth: 150 }} numberOfLines={1}>
              {l.title}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingHorizontal: 12, minHeight: 34 },
  wrap: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 10, minHeight: 52 },
  icon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '600' },
  form: { gap: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 10 },
  buttons: { flexDirection: 'row', gap: 10 },
});
