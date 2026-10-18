import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useLang } from './lang';
import type { Category } from './types';
import { T } from './ui';

/**
 * Category pictures drawn in the brand's own colours (maroon, sand, ink and
 * gold) instead of uploaded photos, so every category looks the same family
 * in light and dark mode.
 */

export const BRAND = {
  maroon: '#350304',
  maroonDeep: '#240203',
  sand: '#EFE6D8',
  ink: '#141414',
  gold: '#C9A465',
  goldSoft: '#D6B08C',
  white: '#FFFFFF',
};

type Kind = 'bag' | 'shoe' | 'watch' | 'perfume' | 'jewel' | 'glasses' | 'clothes' | 'wallet' | 'beauty' | 'kids' | 'gift' | 'other';

const WORDS: [Kind, RegExp][] = [
  ['bag', /حقيب|حقائب|شنط|شنطة|bag|tote|clutch/i],
  ['shoe', /حذاء|احذي|أحذي|جزم|نعال|كعب|سنيكر|shoe|sneaker|heel|boot|sandal/i],
  ['watch', /ساع|watch/i],
  ['perfume', /عطر|عطور|بخور|perfume|fragrance|scent/i],
  ['jewel', /مجوهر|ذهب|خاتم|عقد|اسوار|أسوار|jewel|ring|necklace|bracelet|gold/i],
  ['glasses', /نظار|glass|eyewear/i],
  ['wallet', /محفظ|محافظ|wallet|card holder|cardholder/i],
  ['beauty', /مكياج|تجميل|عناية|beauty|makeup|skin|care/i],
  ['kids', /اطفال|أطفال|طفل|kid|child|baby/i],
  ['gift', /هدي|هدايا|gift/i],
  ['clothes', /ملابس|ازياء|أزياء|فستان|عباي|قميص|cloth|wear|dress|fashion|abaya|ready/i],
];

export function kindOf(c: Category): Kind {
  const text = `${c.name_en ?? ''} ${c.name_ar ?? ''}`;
  for (const [k, re] of WORDS) if (re.test(text)) return k;
  return 'other';
}

export function CategoryIcon({ kind, size = 40, color = BRAND.gold, stroke = 1.1 }: { kind: Kind; size?: number; color?: string; stroke?: number }) {
  const p = { stroke: color, strokeWidth: stroke, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {kind === 'bag' && (<><Path d="M10 18h28l-2.5 22h-23z" {...p} /><Path d="M17 18c0-6 2.8-9.5 7-9.5s7 3.5 7 9.5" {...p} /><Path d="M21 24h6" {...p} /></>)}
      {kind === 'shoe' && (<><Path d="M7 33c0-3 1-9 2-12l7 3c3 1.3 5 4 8 5.4l12 3.6c3 .9 5 2.6 5 4H7z" {...p} /><Path d="M7 36.5h35" {...p} /><Path d="M13 33v3.5" {...p} /></>)}
      {kind === 'watch' && (<><Circle cx={24} cy={24} r={9} {...p} /><Path d="M18 16.5l1.5-8h9l1.5 8M18 31.5l1.5 8h9l1.5-8" {...p} /><Path d="M24 19v5l3 2" {...p} /></>)}
      {kind === 'perfume' && (<><Rect x={13} y={20} width={22} height={20} rx={3} {...p} /><Path d="M20 20v-4h8v4M22 16v-4h4v4" {...p} /><Path d="M18 30h12" {...p} /></>)}
      {kind === 'jewel' && (<><Path d="M14 18l4-6h12l4 6-10 18z" {...p} /><Path d="M14 18h20M20 12l4 6 4-6M24 18v18" {...p} /></>)}
      {kind === 'glasses' && (<><Circle cx={15} cy={26} r={6.5} {...p} /><Circle cx={33} cy={26} r={6.5} {...p} /><Path d="M21.5 25c1.5-1.4 3.5-1.4 5 0M8.5 25L6 17M39.5 25L42 17" {...p} /></>)}
      {kind === 'wallet' && (<><Rect x={8} y={14} width={32} height={22} rx={2} {...p} /><Path d="M28 22h12v8H28a4 4 0 0 1 0-8z" {...p} /><Circle cx={29} cy={26} r={1} {...p} /></>)}
      {kind === 'beauty' && (<><Rect x={18} y={24} width={12} height={16} {...p} /><Path d="M20 24v-8l8-4v12" {...p} /><Path d="M16 40h16" {...p} /></>)}
      {kind === 'kids' && (<><Circle cx={24} cy={15} r={5} {...p} /><Path d="M15 40l2-14h14l2 14M19 26l-5 5M29 26l5 5" {...p} /></>)}
      {kind === 'gift' && (<><Rect x={10} y={20} width={28} height={20} {...p} /><Path d="M8 15h32v5H8zM24 15v25M24 15c-3-6-10-6-8-1M24 15c3-6 10-6 8-1" {...p} /></>)}
      {kind === 'clothes' && (<><Path d="M24 13a3 3 0 1 1 3 3c-1.6 0-3 1-3 2.5v1.5M24 20L8 31h32z" {...p} /><Path d="M8 31v2h32v-2" {...p} /></>)}
      {kind === 'other' && (<><Path d="M24 9l4 10 11 1-8 7 2.5 11L24 32l-9.5 6L17 27l-8-7 11-1z" {...p} /></>)}
    </Svg>
  );
}

const SCHEMES = [
  { bg: BRAND.maroon, title: BRAND.white, sub: BRAND.goldSoft, art: BRAND.gold },
  { bg: BRAND.sand, title: '#2A1A12', sub: '#8A6A2E', art: '#8A6A2E' },
  { bg: BRAND.ink, title: BRAND.white, sub: BRAND.goldSoft, art: BRAND.gold },
];

/** A full picture tile: colour field, gold drawing, Arabic + English name. */
export function CategoryArt({ c, index = 0, width, height, style, compact }: {
  c: Category; index?: number; width: number; height: number; style?: StyleProp<ViewStyle>; compact?: boolean;
}) {
  const { pick, isAr } = useLang();
  const s = SCHEMES[index % SCHEMES.length];
  const kind = kindOf(c);
  const en = (c.name_en || '').toUpperCase();
  const name = pick(c, 'name');
  const icon = Math.min(width, height) * (compact ? 0.32 : 0.3);
  return (
    <View style={[{ width, height, backgroundColor: s.bg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', padding: 14 }, style]}>
      {/* Faint oversized drawing in the corner */}
      <View style={{ position: 'absolute', right: -width * 0.12, bottom: -height * 0.1, opacity: 0.12 }}>
        <CategoryIcon kind={kind} size={Math.max(width, height) * 0.75} color={s.art} stroke={0.8} />
      </View>
      <View style={{ position: 'absolute', top: 8, left: 8, right: 8, bottom: 8, borderWidth: 0.6, borderColor: s.art, opacity: 0.45 }} />
      <CategoryIcon kind={kind} size={icon} color={s.art} stroke={1.1} />
      <T size={compact ? 15 : 19} w="medium" color={s.title} center lines={1} style={{ marginTop: compact ? 8 : 12 }}>{name}</T>
      {en && (isAr || en !== name.toUpperCase()) ? (
        <T latin size={compact ? 9 : 10.5} spacing={compact ? 2 : 3} color={s.sub} center lines={1} style={{ marginTop: 2 }}>{en}</T>
      ) : null}
    </View>
  );
}
