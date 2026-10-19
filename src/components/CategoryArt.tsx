import type { Category } from '../lib/types';
import { usePrefs } from '../lib/prefs';
import { imageUrl } from '../lib/api';

type Kind = 'bag' | 'shoe' | 'watch' | 'perfume' | 'jewel' | 'glasses' | 'clothes' | 'wallet' | 'beauty' | 'kids' | 'gift' | 'pen' | 'belt' | 'travel' | 'home' | 'other';
const WORDS: [Kind, RegExp][] = [
  ['home', /منزل|شمع|home|candle/i],
  ['gift', /هدي|هدايا|gift/i],
  ['travel', /سفر|travel|luggage/i],
  ['pen', /قلم|اقلام|أقلام|pen/i],
  ['belt', /حزام|أحزمة|احزمة|belt/i],
  ['bag', /حقيب|حقائب|شنط|bag|tote|clutch/i],
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
  const t = `${c.name_en ?? ''} ${c.name_ar ?? ''}`;
  for (const [k, re] of WORDS) if (re.test(t)) return k;
  return 'other';
}

export function CategoryGlyph({ kind, size = 48, stroke = 1.1 }: { kind: Kind; size?: number; stroke?: number }) {
  const p = { stroke: 'currentColor', strokeWidth: stroke, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      {kind === 'bag' && (<><path d="M10 18h28l-2.5 22h-23z" {...p} /><path d="M17 18c0-6 2.8-9.5 7-9.5s7 3.5 7 9.5" {...p} /><path d="M21 24h6" {...p} /></>)}
      {kind === 'shoe' && (<><path d="M7 33c0-3 1-9 2-12l7 3c3 1.3 5 4 8 5.4l12 3.6c3 .9 5 2.6 5 4H7z" {...p} /><path d="M7 36.5h35M13 33v3.5" {...p} /></>)}
      {kind === 'watch' && (<><circle cx={24} cy={24} r={9} {...p} /><path d="M18 16.5l1.5-8h9l1.5 8M18 31.5l1.5 8h9l1.5-8M24 19v5l3 2" {...p} /></>)}
      {kind === 'perfume' && (<><rect x={13} y={20} width={22} height={20} rx={3} {...p} /><path d="M20 20v-4h8v4M22 16v-4h4v4M18 30h12" {...p} /></>)}
      {kind === 'jewel' && (<><path d="M14 18l4-6h12l4 6-10 18z" {...p} /><path d="M14 18h20M20 12l4 6 4-6M24 18v18" {...p} /></>)}
      {kind === 'glasses' && (<><circle cx={15} cy={26} r={6.5} {...p} /><circle cx={33} cy={26} r={6.5} {...p} /><path d="M21.5 25c1.5-1.4 3.5-1.4 5 0M8.5 25L6 17M39.5 25L42 17" {...p} /></>)}
      {kind === 'wallet' && (<><rect x={8} y={14} width={32} height={22} rx={2} {...p} /><path d="M28 22h12v8H28a4 4 0 0 1 0-8z" {...p} /></>)}
      {kind === 'beauty' && (<><rect x={18} y={24} width={12} height={16} {...p} /><path d="M20 24v-8l8-4v12M16 40h16" {...p} /></>)}
      {kind === 'kids' && (<><circle cx={24} cy={15} r={5} {...p} /><path d="M15 40l2-14h14l2 14M19 26l-5 5M29 26l5 5" {...p} /></>)}
      {kind === 'gift' && (<><rect x={10} y={20} width={28} height={20} {...p} /><path d="M8 15h32v5H8zM24 15v25M24 15c-3-6-10-6-8-1M24 15c3-6 10-6 8-1" {...p} /></>)}
      {kind === 'clothes' && (<><path d="M24 13a3 3 0 1 1 3 3c-1.6 0-3 1-3 2.5v1.5M24 20L8 31h32z" {...p} /><path d="M8 31v2h32v-2" {...p} /></>)}
      {kind === 'pen' && (<><path d="M30 8l10 10-20 20-12 2 2-12z" {...p} /><path d="M26 12l10 10M10 38l6-6" {...p} /></>)}
      {kind === 'belt' && (<><rect x={6} y={20} width={36} height={9} rx={1.5} {...p} /><rect x={15} y={17} width={11} height={15} rx={2} {...p} /><path d="M20.5 24.5h8M33 24.5h.01M37 24.5h.01" {...p} /></>)}
      {kind === 'travel' && (<><rect x={12} y={15} width={24} height={25} rx={3} {...p} /><path d="M19 15v-5h10v5M18 40v3M30 40v3M12 25h24" {...p} /></>)}
      {kind === 'home' && (<><path d="M16 22h16v18H16z" {...p} /><path d="M24 22v-5M24 8c3 3 3 6 0 9-3-3-3-6 0-9z" {...p} /><path d="M14 40h20" {...p} /></>)}
      {kind === 'other' && <path d="M24 9l4 10 11 1-8 7 2.5 11L24 32l-9.5 6L17 27l-8-7 11-1z" {...p} />}
    </svg>
  );
}

/** Category tile in the brand colours (maroon / sand / ink with gold). */
export function CategoryArt({ c, index = 0, compact }: { c: Category; index?: number; compact?: boolean }) {
  const { pick } = usePrefs();
  const scheme = ['art-maroon', 'art-sand', 'art-ink'][index % 3];
  const kind = kindOf(c);
  // A photo set for the category in the dashboard: photo tile with the name on it.
  if (c.image) {
    return (
      <div className={`cat-photo${compact ? ' compact' : ''}`}>
        <img src={imageUrl(c.image)} alt="" loading="lazy" />
        <span className="cat-photo-name">{pick(c, 'name')}</span>
      </div>
    );
  }
  return (
    <div className={`cat-art ${scheme}${compact ? ' compact' : ''}`}>
      <span className="cat-art-ghost"><CategoryGlyph kind={kind} size={260} stroke={0.7} /></span>
      <span className="cat-art-frame" />
      <span className="cat-art-glyph"><CategoryGlyph kind={kind} size={compact ? 40 : 56} /></span>
      <span className="cat-art-name">{pick(c, 'name')}</span>
      {c.name_en ? <span className="cat-art-en">{c.name_en.toUpperCase()}</span> : null}
    </div>
  );
}
