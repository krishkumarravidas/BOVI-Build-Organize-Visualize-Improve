/** A saved web link (GitHub repo, Drive folder, Google Doc, notes...) on a subject or project. */
export interface ResourceLink {
  id: string;
  title: string;
  url: string;
}

export type LinkKind =
  | 'github'
  | 'drive-folder'
  | 'drive'
  | 'doc'
  | 'sheet'
  | 'slides'
  | 'form'
  | 'classroom'
  | 'youtube'
  | 'notion'
  | 'figma'
  | 'game'
  | 'trello'
  | 'pdf'
  | 'web';

export interface LinkInfo {
  kind: LinkKind;
  /** e.g. "GitHub", "Drive folder", "Google Doc". */
  label: string;
  /** Ionicons glyph name. */
  icon: string;
  /** Brand-ish colour; null means "use the theme's text colour". */
  color: string | null;
}

const INFO: Record<LinkKind, Omit<LinkInfo, 'kind'>> = {
  github: { label: 'GitHub', icon: 'logo-github', color: null },
  'drive-folder': { label: 'Drive folder', icon: 'folder-open', color: '#1FA463' },
  drive: { label: 'Drive file', icon: 'document', color: '#1FA463' },
  doc: { label: 'Google Doc', icon: 'document-text', color: '#4285F4' },
  sheet: { label: 'Google Sheet', icon: 'grid', color: '#0F9D58' },
  slides: { label: 'Google Slides', icon: 'easel', color: '#F4B400' },
  form: { label: 'Google Form', icon: 'list', color: '#7248B9' },
  classroom: { label: 'Classroom', icon: 'school', color: '#1E8E3E' },
  youtube: { label: 'YouTube', icon: 'logo-youtube', color: '#FF0000' },
  notion: { label: 'Notion', icon: 'book', color: null },
  figma: { label: 'Figma', icon: 'logo-figma', color: '#A259FF' },
  game: { label: 'Store page', icon: 'game-controller', color: '#A594F9' },
  trello: { label: 'Trello', icon: 'clipboard', color: '#0079BF' },
  pdf: { label: 'PDF', icon: 'document', color: '#DC2626' },
  web: { label: 'Link', icon: 'link', color: null },
};

// RN's URL polyfill doesn't implement hostname/pathname, so parse by hand.
const URL_RE = /^(https?):\/\/([^/?#\s:]+)(?::\d+)?([^?#\s]*)(\?[^#\s]*)?(#\S*)?$/i;

export interface ParsedUrl {
  host: string;
  path: string;
}

export function parseUrl(url: string): ParsedUrl | null {
  const m = URL_RE.exec(url);
  if (!m || !m[2].includes('.')) return null;
  return { host: m[2].toLowerCase().replace(/^www\./, ''), path: m[3] || '/' };
}

/** Accepts "github.com/me/repo" or a full URL; returns a normalised https URL, or null if it isn't one. */
export function normalizeUrl(input: string): string | null {
  const t = input.trim();
  if (!t || /\s/.test(t)) return null;
  const withScheme = /^https?:\/\//i.test(t) ? t : /^[a-z][a-z0-9+.-]*:/i.test(t) ? null : `https://${t}`;
  if (!withScheme) return null;
  return parseUrl(withScheme) ? withScheme : null;
}

export function linkInfo(url: string): LinkInfo {
  const p = parseUrl(url);
  const kind = p ? kindOf(p) : 'web';
  return { kind, ...INFO[kind] };
}

function kindOf({ host, path }: ParsedUrl): LinkKind {
  if (host === 'github.com' || host === 'gist.github.com' || host.endsWith('.github.io')) return 'github';
  if (host === 'drive.google.com') return path.includes('/folders/') || path.includes('/drive/') ? 'drive-folder' : 'drive';
  if (host === 'docs.google.com') {
    if (path.startsWith('/document')) return 'doc';
    if (path.startsWith('/spreadsheets')) return 'sheet';
    if (path.startsWith('/presentation')) return 'slides';
    if (path.startsWith('/forms')) return 'form';
    return 'drive';
  }
  if (host === 'forms.gle') return 'form';
  if (host === 'classroom.google.com') return 'classroom';
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be') return 'youtube';
  if (host === 'notion.so' || host.endsWith('.notion.site') || host === 'notion.site') return 'notion';
  if (host === 'figma.com') return 'figma';
  if (host === 'itch.io' || host.endsWith('.itch.io') || host === 'store.steampowered.com') return 'game';
  if (host === 'trello.com') return 'trello';
  if (/\.pdf$/i.test(path)) return 'pdf';
  return 'web';
}

/** A sensible default title: "owner/repo" for GitHub, the kind for Google files, else the site name. */
export function suggestTitle(url: string): string {
  const p = parseUrl(url);
  if (!p) return url;
  const info = linkInfo(url);
  const parts = p.path.split('/').filter(Boolean);
  if (info.kind === 'github' && p.host === 'github.com' && parts.length >= 2) return `${parts[0]}/${parts[1].replace(/\.git$/, '')}`;
  if (info.kind === 'github' && p.host === 'github.com' && parts.length === 1) return parts[0];
  if (info.kind === 'pdf') return decodeSafe(parts[parts.length - 1] ?? 'PDF');
  if (info.kind !== 'web' && info.kind !== 'game') return info.label;
  if (info.kind === 'game' && p.host.endsWith('.itch.io') && parts.length) return `${parts[0]} (itch.io)`;
  return p.host;
}

function decodeSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Short "host/path" shown under a link's title. */
export function displayUrl(url: string): string {
  const p = parseUrl(url);
  if (!p) return url;
  const path = p.path === '/' ? '' : p.path.replace(/\/$/, '');
  const full = p.host + path;
  return full.length > 42 ? `${full.slice(0, 41)}…` : full;
}

export function validateLink(input: { url: string; title?: string }): { url: string; title: string } | { error: string } {
  const url = normalizeUrl(input.url);
  if (!url) return { error: 'Paste a web link, e.g. https://github.com/you/repo' };
  return { url, title: input.title?.trim() || suggestTitle(url) };
}

export function addLink(links: readonly ResourceLink[] | undefined, link: ResourceLink): ResourceLink[] {
  return [...(links ?? []), link];
}

export function removeLink(links: readonly ResourceLink[] | undefined, id: string): ResourceLink[] {
  return (links ?? []).filter((l) => l.id !== id);
}

/** Keeps only well-formed links (for restoring backups / migrating stored data). */
export function sanitizeLinks(value: unknown): ResourceLink[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (l): l is ResourceLink =>
      !!l && typeof l === 'object' && typeof l.id === 'string' && typeof l.url === 'string' && typeof l.title === 'string' && normalizeUrl(l.url) !== null,
  );
}
