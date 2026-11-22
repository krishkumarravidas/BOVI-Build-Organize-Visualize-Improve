import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { BackHandler, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

import { Button } from '@/components/Button';
import { useProjects } from '@/hooks/useProjects';
import { useTheme } from '@/hooks/useTheme';

/**
 * Tiny capture sheet opened by the Game dev widget's "+ Idea" button (bovi://quick-idea). When it was the
 * first screen (opened straight from the widget) it closes the app afterwards, so you land back on the
 * home screen.
 */
export default function QuickIdeaScreen() {
  const theme = useTheme();
  const { addIdea } = useProjects();
  const [text, setText] = useState('');
  const [saved, setSaved] = useState(false);

  const close = () => {
    if (router.canGoBack()) router.back();
    else if (Platform.OS === 'android') BackHandler.exitApp();
    else router.replace('/ideas');
  };

  const save = () => {
    if (!text.trim()) return;
    addIdea(text);
    setSaved(true);
    // Give the store a moment to persist before leaving.
    setTimeout(close, 700);
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.backdrop}>
      <Stack.Screen options={{ presentation: 'transparentModal', animation: 'fade', headerShown: false }} />
      <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" />
      <View style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.title, { color: theme.text }]}>{saved ? 'Saved to your ideas' : 'Quick idea'}</Text>
        {saved ? null : (
          <>
            <TextInput
              value={text}
              onChangeText={setText}
              autoFocus
              multiline
              placeholder="What's the idea?"
              placeholderTextColor={theme.muted}
              accessibilityLabel="Idea"
              style={[styles.input, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]}
            />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Button title="Cancel" variant="plain" onPress={close} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title="Save idea" onPress={save} disabled={!text.trim()} />
              </View>
            </View>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 12 },
  title: { fontSize: 18, fontWeight: '700' },
  input: { minHeight: 90, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 12, fontSize: 16, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 10 },
});
