import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { openLink } from '@/components/LinkList';
import { NotFound, Stat, StatRow, styles, useRouteProject } from '@/components/gamedev/common';
import { Card, Chip, ChipRow, EmptyText, ErrorText, Field, ScreenHeader, SectionTitle } from '@/components/ui';
import { useCommitCache } from '@/hooks/useCommitCache';
import { useTheme } from '@/hooks/useTheme';
import { fromDateKey, toDateKey } from '@/lib/dates';
import { commitsThisWeek, fetchCommits, loadCommitCache, loadToken, parseRepo, projectRepo, repoKey, saveCommits, saveToken } from '@/lib/github';
import { weekStart } from '@/lib/insights';

/** Recent commits on the project's GitHub repo — proof of progress without writing a devlog. */
export default function CommitsScreen() {
  const theme = useTheme();
  const { project, p } = useRouteProject();
  const [cache, setCache] = useCommitCache();
  const [token, setToken] = useState('');
  const [hasToken, setHasToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const repo = project ? projectRepo(project) : null;
  const key = repo ? repoKey(repo.ref) : '';
  const cached = key ? cache[key] : undefined;

  useEffect(() => {
    loadToken().then((t) => setHasToken(!!t));
  }, []);

  const refresh = async () => {
    if (!repo) return;
    const saved = await loadToken();
    setLoading(true);
    setError(null);
    const res = await fetchCommits(repo.ref, saved);
    setLoading(false);
    if (!res.ok) return setError(res.error);
    setCache(await saveCommits(repo.ref, res.commits, Date.now()));
  };

  // Fetch once on open if the stored copy is missing or over an hour old.
  const ref = repo?.ref;
  useEffect(() => {
    if (!ref) return;
    let live = true;
    (async () => {
      const entry = (await loadCommitCache())[repoKey(ref)];
      if (entry && Date.now() - entry.fetchedAt < 3_600_000) return;
      const res = await fetchCommits(ref, await loadToken());
      if (!live) return;
      if (!res.ok) setError(res.error);
      else setCache(await saveCommits(ref, res.commits, Date.now()));
    })();
    return () => {
      live = false;
    };
    // Re-run only when the repo changes, not on every render's new `ref` object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!project) return <NotFound />;
  const githubLinks = (project.links ?? []).filter((l) => parseRepo(l.url));
  const commits = cached?.commits ?? [];
  const thisWeek = commitsThisWeek(commits, fromDateKey(weekStart(toDateKey(new Date()))).getTime());

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <ScreenHeader title={`${project.name}: commits`} />
      {!repo ? (
        <Card>
          <Text style={{ color: theme.text, fontWeight: '700' }}>No GitHub repo linked</Text>
          <Text style={{ color: theme.muted }}>Add the repo under Links on the project (e.g. github.com/you/{project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}), then come back.</Text>
        </Card>
      ) : (
        <>
          {githubLinks.length > 1 ? (
            <ChipRow>
              {githubLinks.map((l) => (
                <Chip key={l.id} label={l.title} selected={repo.link.id === l.id} onPress={() => p.apply((s) => ({ ...s, projects: s.projects.map((x) => (x.id === project.id ? { ...x, repoLinkId: l.id } : x)) }))} />
              ))}
            </ChipRow>
          ) : null}
          <StatRow>
            <Stat value={String(thisWeek)} label="commits this week" color={thisWeek ? theme.accent : theme.text} />
            <Stat value={String(commits.length)} label="recent" />
          </StatRow>
          <Text style={{ color: theme.muted, fontSize: 13 }}>
            {repo.ref.owner}/{repo.ref.repo}
            {cached ? ` · updated ${new Date(cached.fetchedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : ''}. Commit days count towards your streak.
          </Text>
          <Button title={loading ? 'Loading…' : 'Refresh'} variant="plain" onPress={refresh} disabled={loading} />
          <ErrorText>{error}</ErrorText>
          <SectionTitle>Recent commits</SectionTitle>
          {commits.length === 0 && !loading ? <EmptyText>No commits loaded.</EmptyText> : null}
          {commits.map((c) => (
            <Pressable key={c.sha} onPress={() => openLink(c.url)} accessibilityRole="link" accessibilityLabel={c.message} style={[local.row, { borderColor: theme.border }]}>
              <Text style={{ color: theme.text, fontSize: 15 }} numberOfLines={2}>
                {c.message}
              </Text>
              <Text style={{ color: theme.muted, fontSize: 12 }}>
                {c.sha.slice(0, 7)} · {c.author} · {c.date ? new Date(c.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : ''}
              </Text>
            </Pressable>
          ))}
        </>
      )}

      <SectionTitle>Private repos</SectionTitle>
      <Card>
        <Text style={{ color: theme.muted }}>
          Public repos work without this. For private ones, create a fine-grained token on GitHub (Settings → Developer settings → Personal access tokens) with read-only “Contents” access to the repo. It’s stored only on this phone and never included in backups.
        </Text>
        <Field label={hasToken ? 'Token saved — paste a new one to replace it' : 'GitHub token'} value={token} onChangeText={setToken} placeholder="github_pat_…" autoCapitalize="none" autoCorrect={false} secureTextEntry />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {hasToken ? (
            <View style={{ flex: 1 }}>
              <Button
                title="Remove token"
                variant="danger"
                onPress={async () => {
                  await saveToken(null);
                  setHasToken(false);
                }}
              />
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            <Button
              title="Save token"
              onPress={async () => {
                if (!token.trim()) return;
                await saveToken(token);
                setToken('');
                setHasToken(true);
                refresh();
              }}
              disabled={!token.trim()}
            />
          </View>
        </View>
      </Card>
    </ScrollView>
  );
}

const local = StyleSheet.create({ row: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 8, gap: 2 } });
