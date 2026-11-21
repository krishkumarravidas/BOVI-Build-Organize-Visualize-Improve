/**
 * BOVI colour system — "ink & iris".
 *
 * A near-black ink with a violet undertone (from the logo), warm paper in light mode, one signature
 * iris accent and a small set of functional colours. Every text/background pair used for text meets
 * WCAG AA (4.5:1); see colors.test.ts.
 */
export const palette = {
  light: {
    /** Page. Warm paper, not pure white. */
    background: '#F7F6F3',
    /** Cards and rows. */
    surface: '#FFFFFF',
    /** Inputs, chips, segmented tracks: one step up from the page. */
    raised: '#EFEDF1',
    text: '#17151C',
    muted: '#66626F',
    primary: '#5B45D6',
    /** Text/icons drawn on top of `primary`. */
    onPrimary: '#FFFFFF',
    danger: '#B03A33',
    /** Success / "done" / schedule blocks. */
    accent: '#157352',
    /** Warnings ("on the line", amber states). */
    warn: '#875500',
    border: '#E4E1E8',
  },
  dark: {
    background: '#0F0E13',
    surface: '#18171E',
    raised: '#232129',
    text: '#EEEDF2',
    muted: '#9A97A5',
    primary: '#A594F9',
    onPrimary: '#16121F',
    danger: '#F07470',
    accent: '#4CC9A0',
    warn: '#E8B44C',
    border: '#2B2933',
  },
} as const;

export type Theme = typeof palette.light | typeof palette.dark;

/** Shape and spacing scale shared by components, so corners and gaps stay consistent. */
export const radius = { sm: 10, md: 14, lg: 18, pill: 999 } as const;
