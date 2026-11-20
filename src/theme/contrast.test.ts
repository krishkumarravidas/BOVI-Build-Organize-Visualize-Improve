import { SUBJECT_COLORS } from '@/lib/college';

import { contrastRatio, readableOn } from './contrast';

describe('readableOn', () => {
  it('picks text with at least 4.5:1 contrast for every subject colour', () => {
    for (const c of SUBJECT_COLORS) expect(contrastRatio(readableOn(c), c)).toBeGreaterThanOrEqual(4.5);
  });
  it('uses white on dark and black on light', () => {
    expect(readableOn('#111111')).toBe('#FFFFFF');
    expect(readableOn('#FDE68A')).toBe('#111827');
  });
});

describe('mix', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { mix } = require('./contrast');
  it('blends two colours', () => {
    expect(mix('#000000', '#FFFFFF', 0.5)).toBe('#808080');
    expect(mix('#0B0F19', '#4F46E5', 0)).toBe('#0b0f19');
    expect(mix('#0B0F19', '#4F46E5', 1)).toBe('#4f46e5');
  });
});
