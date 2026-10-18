// Design tokens from the approved app design: white, near-black ink,
// quiet greys, maroon and gold only as small accents. No rounded cards.
export const C = {
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
  red: '#B3261E',
  amber: '#9A6200',
  white: '#FFFFFF',
} as const;

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
