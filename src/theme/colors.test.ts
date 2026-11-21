import { SUBJECT_COLORS, refreshSubjectColor } from '@/lib/college';

import { palette } from './colors';
import { contrastRatio, readableOn } from './contrast';

describe('palette', () => {
  for (const [name, t] of Object.entries(palette)) {
    describe(name, () => {
      // Every colour that is used for text, on every background it appears on.
      const backgrounds = { background: t.background, surface: t.surface, raised: t.raised };
      const textColours = { text: t.text, muted: t.muted, primary: t.primary, danger: t.danger, accent: t.accent, warn: t.warn };
      for (const [bgName, bg] of Object.entries(backgrounds)) {
        for (const [fgName, fg] of Object.entries(textColours)) {
          it(`${fgName} on ${bgName} meets AA`, () => {
            expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
          });
        }
      }
      it('onPrimary on primary meets AA', () => {
        expect(contrastRatio(t.onPrimary, t.primary)).toBeGreaterThanOrEqual(4.5);
      });
      it('surfaces step up from the page', () => {
        expect(new Set([t.background, t.surface, t.raised]).size).toBe(3);
      });
    });
  }

  it('subject colours stay readable with white or ink text', () => {
    for (const c of SUBJECT_COLORS) expect(contrastRatio(readableOn(c), c)).toBeGreaterThanOrEqual(4.5);
  });

  it('moves old default subject colours onto the current palette, keeping custom ones', () => {
    expect(refreshSubjectColor('#4F46E5')).toBe('#3A3A3A');
    // The violet from the previous palette moves to charcoal (the UI is black and white now).
    expect(refreshSubjectColor('#6E56CF')).toBe('#3A3A3A');
    expect(refreshSubjectColor('#0d9488')).toBe('#187A63');
    expect(refreshSubjectColor('#123456')).toBe('#123456');
    for (const c of ['#4F46E5', '#0D9488', '#D97706', '#DB2777', '#2563EB', '#7C3AED', '#059669', '#DC2626', '#64748B']) expect(SUBJECT_COLORS).toContain(refreshSubjectColor(c));
  });
});
