// All text/background pairs below meet WCAG AA (4.5:1) — checked when this was written.
export const palette = {
  light: {
    background: '#FFFFFF',
    surface: '#F4F5F7',
    text: '#111827',
    muted: '#5B6472',
    primary: '#4F46E5',
    /** Text/icons drawn on top of `primary`. */
    onPrimary: '#FFFFFF',
    danger: '#B91C1C',
    /** Schedule blocks (bars and dots, not text). */
    accent: '#0D9488',
    border: '#E5E7EB',
  },
  dark: {
    background: '#0B0F19',
    surface: '#161B27',
    text: '#F3F4F6',
    muted: '#9CA3AF',
    primary: '#818CF8',
    onPrimary: '#0B0F19',
    danger: '#F87171',
    accent: '#2DD4BF',
    border: '#2A3142',
  },
} as const;

export type Theme = typeof palette.light | typeof palette.dark;
