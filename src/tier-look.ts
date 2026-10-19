/** Member card colours by tier name (bronze, silver, gold, platinum, privilege…). */
export interface TierLook {
  bg: [string, string];
  ink: string;
  soft: string;
  sub: string;
  line: string;
}

const MAROON: TierLook = { bg: ['#4A0A12', '#2A0204'], ink: '#FFFFFF', soft: '#D6B08C', sub: 'rgba(255,255,255,0.72)', line: '#C9A465' };

const LOOKS: [RegExp, TierLook][] = [
  [/bronze|برونز/i, { bg: ['#9A6440', '#5A3520'], ink: '#FFF6EE', soft: '#F2CFA8', sub: 'rgba(255,246,238,0.78)', line: '#E9B98A' }],
  [/silver|فض/i, { bg: ['#E3E5E8', '#A9AEB5'], ink: '#1E2226', soft: '#4B5259', sub: 'rgba(30,34,38,0.7)', line: '#7D848C' }],
  [/gold|ذهب/i, { bg: ['#E4C27A', '#B08A45'], ink: '#2A1A08', soft: '#5C3D10', sub: 'rgba(42,26,8,0.72)', line: '#7A5520' }],
  [/platinum|بلاتين/i, { bg: ['#34343A', '#0E0E11'], ink: '#F4F4F6', soft: '#D9D9DE', sub: 'rgba(244,244,246,0.7)', line: '#B9B9C0' }],
  [/privilege|vip|elite|black|نخب|امتياز|بريفل/i, { bg: ['#141414', '#000000'], ink: '#E8D3A6', soft: '#C9A465', sub: 'rgba(232,211,166,0.75)', line: '#C9A465' }],
];

export function tierLook(name?: string | null): TierLook {
  const n = name ?? '';
  for (const [re, look] of LOOKS) if (re.test(n)) return look;
  return MAROON;
}
