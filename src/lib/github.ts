import AsyncStorage from '@react-native-async-storage/async-storage';

import { toDateKey } from './dates';
import { parseUrl, type ResourceLink } from './links';
import type { Project } from './projects';
import type { DateKey } from './types';

/** Stored on its own key so it is never included in backups. */
export const GITHUB_TOKEN_KEY = 'bovi/github-token';
const CACHE_KEY = 'bovi/github-commits';

export interface Commit {
  sha: string;
  message: string;
  /** ISO date. */
  date: string;
  author: string;
  url: string;
}

export interface RepoRef {
  owner: string;
  repo: string;
}

export function parseRepo(url: string): RepoRef | null {
  const p = parseUrl(url);
  if (!p || p.host !== 'github.com') return null;
  const [owner, repo] = p.path.split('/').filter(Boolean);
  if (!owner || !repo) return null;
  return { owner, repo: repo.replace(/\.git$/, '') };
}

/** The project's chosen repo link, else its first GitHub repo link. */
export function projectRepo(project: Project): { link: ResourceLink; ref: RepoRef } | null {
  const links = project.links ?? [];
  const ordered = project.repoLinkId ? [...links.filter((l) => l.id === project.repoLinkId), ...links] : links;
  for (const link of ordered) {
    const ref = parseRepo(link.url);
    if (ref) return { link, ref };
  }
  return null;
}

export function repoKey(ref: RepoRef): string {
  return `${ref.owner}/${ref.repo}`.toLowerCase();
}

export type CommitsResult = { ok: true; commits: Commit[] } | { ok: false; error: string };

interface RawCommit {
  sha: string;
  html_url: string;
  commit: { message: string; author?: { name?: string; date?: string } | null };
  author?: { login?: string } | null;
}

export function parseCommits(raw: unknown): Commit[] {
  if (!Array.isArray(raw)) return [];
  return (raw as RawCommit[])
    .filter((c) => c && typeof c.sha === 'string' && c.commit)
    .map((c) => ({
      sha: c.sha,
      message: (c.commit.message ?? '').split('\n')[0],
      date: c.commit.author?.date ?? '',
      author: c.author?.login ?? c.commit.author?.name ?? '',
      url: c.html_url,
    }));
}

/** Latest commits (default branch). Public repos work without a token (60 requests/hour). */
export async function fetchCommits(ref: RepoRef, token?: string | null, fetcher: typeof fetch = fetch): Promise<CommitsResult> {
  try {
    const res = await fetcher(`https://api.github.com/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/commits?per_page=30`, {
      headers: { Accept: 'application/vnd.github+json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (res.status === 404) return { ok: false, error: token ? 'Repo not found, or the token can’t see it.' : 'Repo not found. If it’s private, add a token below.' };
    if (res.status === 401) return { ok: false, error: 'The token was rejected. Check it or make a new one.' };
    if (res.status === 403) return { ok: false, error: 'GitHub rate limit reached. Try again later, or add a token.' };
    if (res.status === 409) return { ok: true, commits: [] }; // empty repository
    if (!res.ok) return { ok: false, error: `GitHub returned ${res.status}.` };
    return { ok: true, commits: parseCommits(await res.json()) };
  } catch {
    return { ok: false, error: 'Couldn’t reach GitHub. Check your connection.' };
  }
}

export function commitDays(commits: readonly Commit[]): DateKey[] {
  return [...new Set(commits.filter((c) => c.date).map((c) => toDateKey(new Date(c.date))))];
}

export function commitsThisWeek(commits: readonly Commit[], weekStartMs: number): number {
  return commits.filter((c) => c.date && new Date(c.date).getTime() >= weekStartMs).length;
}

// ---------- local cache (so streaks/heatmap can count commits offline) ----------

export type CommitCache = Record<string, { fetchedAt: number; commits: Commit[] }>;

export async function loadCommitCache(): Promise<CommitCache> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    const v = raw ? (JSON.parse(raw) as CommitCache) : {};
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

export async function saveCommits(ref: RepoRef, commits: Commit[], now: number): Promise<CommitCache> {
  const cache = await loadCommitCache();
  cache[repoKey(ref)] = { fetchedAt: now, commits };
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Cache is optional.
  }
  return cache;
}

export async function loadToken(): Promise<string | null> {
  try {
    return (await AsyncStorage.getItem(GITHUB_TOKEN_KEY)) || null;
  } catch {
    return null;
  }
}

export async function saveToken(token: string | null): Promise<void> {
  try {
    if (token) await AsyncStorage.setItem(GITHUB_TOKEN_KEY, token.trim());
    else await AsyncStorage.removeItem(GITHUB_TOKEN_KEY);
  } catch {
    // ignore
  }
}
