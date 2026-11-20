import { emptyCollege, migrateCollege, setSubjectLinks } from './college';
import { emptyProjects, migrateProjects, setProjectLinks, upsertProject } from './projects';
import { addLink, displayUrl, linkInfo, normalizeUrl, removeLink, sanitizeLinks, suggestTitle, validateLink } from './links';

describe('links', () => {
  it('normalises bare domains and rejects non-links', () => {
    expect(normalizeUrl('github.com/me/game')).toBe('https://github.com/me/game');
    expect(normalizeUrl('  https://drive.google.com/drive/folders/abc  ')).toBe('https://drive.google.com/drive/folders/abc');
    expect(normalizeUrl('http://example.org')).toBe('http://example.org');
    expect(normalizeUrl('not a link')).toBeNull();
    expect(normalizeUrl('hello')).toBeNull();
    expect(normalizeUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeUrl('mailto:a@b.com')).toBeNull();
    expect(normalizeUrl('')).toBeNull();
  });

  it('recognises GitHub, Drive and Google files', () => {
    expect(linkInfo('https://github.com/me/game').kind).toBe('github');
    expect(linkInfo('https://drive.google.com/drive/folders/1AbC').kind).toBe('drive-folder');
    expect(linkInfo('https://drive.google.com/file/d/1AbC/view').kind).toBe('drive');
    expect(linkInfo('https://docs.google.com/document/d/1x/edit').kind).toBe('doc');
    expect(linkInfo('https://docs.google.com/spreadsheets/d/1x/edit').kind).toBe('sheet');
    expect(linkInfo('https://docs.google.com/presentation/d/1x/edit').kind).toBe('slides');
    expect(linkInfo('https://forms.gle/abc').kind).toBe('form');
    expect(linkInfo('https://classroom.google.com/c/xyz').kind).toBe('classroom');
    expect(linkInfo('https://youtu.be/abc').kind).toBe('youtube');
    expect(linkInfo('https://www.youtube.com/watch?v=abc').kind).toBe('youtube');
    expect(linkInfo('https://me.itch.io/game').kind).toBe('game');
    expect(linkInfo('https://example.com/notes/unit1.pdf').kind).toBe('pdf');
    expect(linkInfo('https://example.com').kind).toBe('web');
  });

  it('suggests readable titles', () => {
    expect(suggestTitle('https://github.com/me/shadow-hall.git')).toBe('me/shadow-hall');
    expect(suggestTitle('https://github.com/me')).toBe('me');
    expect(suggestTitle('https://drive.google.com/drive/folders/1AbC')).toBe('Drive folder');
    expect(suggestTitle('https://docs.google.com/document/d/1x/edit')).toBe('Google Doc');
    expect(suggestTitle('https://www.geeksforgeeks.org/dsa')).toBe('geeksforgeeks.org');
    expect(suggestTitle('https://example.com/notes/Unit%201.pdf')).toBe('Unit 1.pdf');
    expect(suggestTitle('https://me.itch.io/shadow-hall')).toBe('shadow-hall (itch.io)');
  });

  it('validates input and keeps a custom title', () => {
    expect(validateLink({ url: 'github.com/me/repo' })).toEqual({ url: 'https://github.com/me/repo', title: 'me/repo' });
    expect(validateLink({ url: 'docs.google.com/document/d/1', title: ' DSA notes ' })).toEqual({ url: 'https://docs.google.com/document/d/1', title: 'DSA notes' });
    expect(validateLink({ url: 'nope' })).toHaveProperty('error');
  });

  it('adds, removes and sanitises lists', () => {
    const a = addLink(undefined, { id: '1', title: 'Repo', url: 'https://github.com/me/r' });
    const b = addLink(a, { id: '2', title: 'Notes', url: 'https://docs.google.com/document/d/x' });
    expect(removeLink(b, '1').map((l) => l.id)).toEqual(['2']);
    expect(sanitizeLinks([...b, { id: 3 }, null, { id: '4', title: 'x', url: 'bad url' }])).toEqual(b);
    expect(sanitizeLinks('nope')).toEqual([]);
  });

  it('shortens long URLs for display', () => {
    expect(displayUrl('https://www.github.com/me/repo/')).toBe('github.com/me/repo');
    expect(displayUrl('https://docs.google.com/document/d/1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/edit').endsWith('…')).toBe(true);
  });
});

describe('links on subjects and projects', () => {
  const repo = { id: 'l1', title: 'me/game', url: 'https://github.com/me/game' };

  it('keeps project links when the project form is saved (it never sends links)', () => {
    let s = upsertProject(emptyProjects(), { id: 'p', name: 'Game', status: 'active', tasks: [] });
    s = setProjectLinks(s, 'p', [repo]);
    s = upsertProject(s, { id: 'p', name: 'Game renamed', status: 'active', tasks: [] });
    expect(s.projects[0].links).toEqual([repo]);
    expect(s.projects[0].name).toBe('Game renamed');
  });

  it('migrates stored data: old projects stay as they were and bad links are dropped', () => {
    const m = migrateProjects({ version: 1, projects: [{ id: 'p', name: 'x', status: 'active', tasks: [], links: [repo, { id: 'b', title: 'b', url: 'oops' }] }, { id: 'q', name: 'y', status: 'planned' }] });
    expect(m!.projects[0].links).toEqual([repo]);
    expect(m!.projects[1].links).toBeUndefined();
  });

  it('sets subject links and keeps them through migration', () => {
    const base = { ...emptyCollege(), subjects: [{ id: 'dsa', name: 'DSA', short: 'DSA', color: '#000000' }] };
    const s = setSubjectLinks(base, 'dsa', [repo]);
    expect(s.subjects[0].links).toEqual([repo]);
    expect(migrateCollege(JSON.parse(JSON.stringify(s)))!.subjects[0].links).toEqual([repo]);
    expect(migrateCollege(JSON.parse(JSON.stringify(base)))!.subjects[0].links).toBeUndefined();
  });
});
