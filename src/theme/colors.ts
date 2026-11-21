/**
 * BOVI colour system — "mono".
 *
 * Black and white: neutral greys with no tint, ink-black (light) or paper-white (dark) as the primary,
 * and only three functional colours kept for meaning (danger, done, warning). Every text/background
 * pair used for text meets WCAG AA (4.5:1); see colors.test.ts.
 */
export const palette = {
  light: {
    /** Page. */
    background: '#F4F4F3',
    /** Cards and rows. */
    surface: '#FFFFFF',
    /** Inputs, chips, segmented tracks: one step up from the page. */
    raised: '#EBEBEA',
    text: '#111111',
    muted: '#5E5E5E',
    primary: '#111111',
    /** Text/icons drawn on top of `primary`. */
    onPrimary: '#FFFFFF',
    danger: '#B03A33',
    /** Success / "done" / schedule blocks. */
    accent: '#2F6B4F',
    /** Warnings ("on the line", amber states). */
    warn: '#7D5A12',
    border: '#E2E2E0',
  },
  dark: {
    background: '#0A0A0A',
    surface: '#151515',
    raised: '#202020',
    text: '#F2F2F2',
    muted: '#9B9B9B',
    primary: '#F2F2F2',
    onPrimary: '#0A0A0A',
    danger: '#EE7A74',
    accent: '#7CC4A1',
    warn: '#D9B35E',
    border: '#2A2A2A',
  },
} as const;

export type Theme = typeof palette.light | typeof palette.dark;

/** Shape and spacing scale shared by components, so corners and gaps stay consistent. */
export const radius = { sm: 10, md: 14, lg: 18, pill: 999 } as const;
