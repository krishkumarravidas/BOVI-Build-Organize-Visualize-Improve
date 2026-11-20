import { linkInfo, normalizeUrl, suggestTitle } from './links';

export type ShareTarget = 'subject' | 'project' | 'learning' | 'idea' | 'ref' | 'bug';

export interface ParsedShare {
  /** First web link in the shared text, normalised. */
  url: string | null;
  /** Suggested title: the sender's subject line, else the text around the link, else from the URL. */
  title: string;
  /** The full shared text (minus the link if that's all it was). */
  text: string;
  images: string[];
}

const URL_IN_TEXT = /\bhttps?:\/\/[^\s<>"']+/i;

export function parseShare(input: { text?: string | null; subject?: string | null; images?: readonly string[] }): ParsedShare {
  const text = (input.text ?? '').trim();
  const match = URL_IN_TEXT.exec(text);
  // Trailing punctuation from sentences ("…see https://x.com/a.") isn't part of the link.
  const raw = match ? match[0].replace(/[).,;:!?\]]+$/, '') : null;
  const url = raw ? normalizeUrl(raw) : null;
  const around = match ? text.replace(match[0], '').replace(/\s+/g, ' ').trim().replace(/[\s\-–—:|.,;]+$/, '').trim() : '';
  const subject = input.subject?.trim();
  const title = (subject || (around.length >= 3 && around.length <= 90 ? around : '') || (url ? suggestTitle(url) : text.split('\n')[0])).slice(0, 90);
  return { url, title, text: url && !around ? '' : text, images: [...(input.images ?? [])] };
}

/** Best first guess for where a share belongs. */
export function suggestTarget(p: ParsedShare): ShareTarget {
  if (p.images.length) return 'ref';
  if (!p.url) return 'idea';
  const kind = linkInfo(p.url).kind;
  if (kind === 'github' || kind === 'figma' || kind === 'game' || kind === 'trello') return 'project';
  if (kind === 'youtube' || /udemy|coursera|unrealengine\.com|dev\.epicgames\.com|learn\./i.test(p.url)) return 'learning';
  if (kind === 'drive' || kind === 'drive-folder' || kind === 'doc' || kind === 'sheet' || kind === 'slides' || kind === 'form' || kind === 'classroom' || kind === 'pdf') return 'subject';
  return 'learning';
}

/** Targets that make sense for this share. */
export function availableTargets(p: ParsedShare): ShareTarget[] {
  if (p.images.length) return ['ref', 'bug'];
  return p.url ? ['subject', 'project', 'learning', 'idea'] : ['idea'];
}

export const TARGET_LABEL: Record<ShareTarget, string> = {
  subject: 'Subject links',
  project: 'Project links',
  learning: 'Learning queue',
  idea: 'Ideas inbox',
  ref: 'Reference board',
  bug: 'New bug',
};

// ---------- hand-off from the native share to the /share screen ----------

let pending: ParsedShare | null = null;

export function setPendingShare(p: ParsedShare | null) {
  pending = p;
}

export function peekPendingShare(): ParsedShare | null {
  return pending;
}
