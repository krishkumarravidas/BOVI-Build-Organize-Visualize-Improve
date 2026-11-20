import { availableTargets, parseShare, suggestTarget } from './share';

describe('share to BOVI', () => {
  it('pulls the link and a title out of typical shares', () => {
    // YouTube app: subject = video title, text = link.
    const yt = parseShare({ text: 'https://youtu.be/abc123', subject: 'UE5 Behavior Trees in 20 minutes' });
    expect(yt).toMatchObject({ url: 'https://youtu.be/abc123', title: 'UE5 Behavior Trees in 20 minutes', text: '' });
    expect(suggestTarget(yt)).toBe('learning');

    // Chrome: "Page title https://…"
    const gh = parseShare({ text: 'demo/shadow-hall: horror game https://github.com/demo/shadow-hall' });
    expect(gh.url).toBe('https://github.com/demo/shadow-hall');
    expect(gh.title).toBe('demo/shadow-hall: horror game');
    expect(suggestTarget(gh)).toBe('project');

    // Bare Drive link, trailing punctuation dropped.
    const drive = parseShare({ text: 'notes here: https://drive.google.com/drive/folders/1AbC.' });
    expect(drive.url).toBe('https://drive.google.com/drive/folders/1AbC');
    expect(drive.title).toBe('notes here');
    expect(suggestTarget(drive)).toBe('subject');

    const bare = parseShare({ text: 'https://docs.google.com/document/d/1x/edit' });
    expect(bare.title).toBe('Google Doc');
  });

  it('treats plain text as an idea and images as references', () => {
    const idea = parseShare({ text: 'Game where the shadows lag behind you\nby a second' });
    expect(idea).toMatchObject({ url: null, title: 'Game where the shadows lag behind you' });
    expect(suggestTarget(idea)).toBe('idea');
    expect(availableTargets(idea)).toEqual(['idea']);

    const img = parseShare({ text: null, images: ['file:///a.jpg'] });
    expect(suggestTarget(img)).toBe('ref');
    expect(availableTargets(img)).toEqual(['ref', 'bug']);
  });
});
