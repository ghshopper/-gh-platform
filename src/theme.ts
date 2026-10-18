// Design tokens from the approved app design: white, near-black ink,
// quiet greys, maroon and gold only as small accents. No rounded cards.
//
// `C` is swapped in place between the light and dark palettes (see
// appearance.tsx), so screens keep reading C.ink etc. at render time.
// `white` means "the colour on top of ink": white in light mode, near-black
// in dark mode (button labels, page backgrounds). `pure` is always white
// (text over photos and video).

const LIGHT = {
  bg: '#FFFFFF',
  ink: '#111111',
  sub: '#555555',
  muted: '#707070',
  faint: '#9A9A9A',
  line: '#ECECEC',
  lineStrong: '#D6D6D6',
  surface: '#F4F3F1',
  surface2: '#F7F6F4',
  cream: '#F4F1EC',
  gold: '#8A6A2E',
  maroon: '#350304',
  green: '#2E7D4F',
  greenSoft: '#E8F3EC',
  red: '#B3261E',
  amber: '#9A6200',
  white: '#FFFFFF',
  pure: '#FFFFFF',
  black: '#000000',
  tabBar: 'rgba(255,255,255,0.98)',
  veil: 'rgba(255,255,255,0.88)',
  scrim: 'rgba(0,0,0,0.45)',
  placeholder: '#A6A29C',
};

export type Palette = typeof LIGHT;

const DARK: Palette = {
  bg: '#0D0D0D',
  ink: '#F2F0EC',
  sub: '#BDBAB4',
  muted: '#9C9993',
  faint: '#6F6C67',
  line: '#232323',
  lineStrong: '#3A3A3A',
  surface: '#1A1A19',
  surface2: '#151514',
  cream: '#1D1A16',
  gold: '#CDA86A',
  maroon: '#D9A0A2',
  green: '#6CC793',
  greenSoft: '#16281D',
  red: '#F08A80',
  amber: '#E3B05A',
  white: '#0D0D0D',
  pure: '#FFFFFF',
  black: '#000000',
  tabBar: 'rgba(13,13,13,0.98)',
  veil: 'rgba(13,13,13,0.85)',
  scrim: 'rgba(0,0,0,0.6)',
  placeholder: '#5E5B57',
};

export const C: Palette = { ...LIGHT };

export function applyPalette(dark: boolean) {
  Object.assign(C, dark ? DARK : LIGHT);
}

export const F = {
  light: 'IBMPlexSansArabic_300Light',
  regular: 'IBMPlexSansArabic_400Regular',
  medium: 'IBMPlexSansArabic_500Medium',
  semibold: 'IBMPlexSansArabic_600SemiBold',
  latin: 'Jost_400Regular',
  latinMedium: 'Jost_500Medium',
  serifItalic: 'CormorantGaramond_400Regular_Italic',
} as const;

export const S = { gutter: 20, tabBar: 84 } as const;
