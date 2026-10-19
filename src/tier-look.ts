/** Member card colours by tier name (Beige, Burgundy, Black). */
export interface TierLook {
  bg: [string, string];
  ink: string;
  soft: string;
  sub: string;
  line: string;
}

const MAROON: TierLook = { bg: ['#4A0A12', '#2A0204'], ink: '#FFFFFF', soft: '#D6B08C', sub: 'rgba(255,255,255,0.72)', line: '#C9A465' };

// The three tiers: Beige (0–20k points), Burgundy (20k–50k), Black (50k+).
const LOOKS: [RegExp, TierLook][] = [
  [/beige|بيج/i, { bg: ['#ECDFC9', '#CDB794'], ink: '#2A1A10', soft: '#6B4E2E', sub: 'rgba(42,26,16,0.7)', line: '#8A6A3E' }],
  [/burgundy|bordeaux|عناب/i, { bg: ['#6A0E1A', '#2E0306'], ink: '#FFFFFF', soft: '#D6B08C', sub: 'rgba(255,255,255,0.72)', line: '#C9A465' }],
  [/black|noir|أسود|اسود/i, { bg: ['#1C1C1C', '#000000'], ink: '#E8D3A6', soft: '#C9A465', sub: 'rgba(232,211,166,0.75)', line: '#C9A465' }],
];

export function tierLook(name?: string | null): TierLook {
  const n = name ?? '';
  for (const [re, look] of LOOKS) if (re.test(n)) return look;
  return MAROON;
}
