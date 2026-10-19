import type { Product } from './types';

export type Origin = 'oman' | 'dubai' | 'europe';
export interface EtaRule { min: number; max: number; unit: 'work' | 'days' }
export type EtaTable = Record<Origin, EtaRule>;

export const DEFAULT_ETA: EtaTable = {
  oman: { min: 1, max: 2, unit: 'work' },
  dubai: { min: 4, max: 4, unit: 'work' },
  europe: { min: 7, max: 12, unit: 'days' },
};

/** Where a piece ships from (same rule as the server). */
export function originOf(p: { origin?: string | null; availability?: string | null }): Origin {
  if (p.origin === 'oman' || p.origin === 'dubai' || p.origin === 'europe') return p.origin;
  return p.availability === 'on_order' ? 'europe' : 'oman';
}

const isWeekend = (d: Date) => d.getDay() === 5 || d.getDay() === 6; // Fri, Sat in Oman

function addDays(from: Date, n: number, unit: 'work' | 'days'): Date {
  const d = new Date(from);
  if (unit === 'days') {
    d.setDate(d.getDate() + n);
    return d;
  }
  let left = n;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (!isWeekend(d)) left--;
  }
  return d;
}

export interface EtaInfo { origin: Origin; rule: EtaRule; from: Date; to: Date }

export function etaFor(origin: Origin, table: EtaTable = DEFAULT_ETA, now = new Date()): EtaInfo {
  const rule = table[origin] ?? DEFAULT_ETA[origin];
  return { origin, rule, from: addDays(now, rule.min, rule.unit), to: addDays(now, rule.max, rule.unit) };
}

/** The slowest piece decides when the whole order arrives. */
export function etaForMany(origins: Origin[], table: EtaTable = DEFAULT_ETA): EtaInfo | null {
  if (!origins.length) return null;
  return origins.map((o) => etaFor(o, table)).sort((a, b) => b.to.getTime() - a.to.getTime())[0];
}

export function productEta(p: Product, table?: EtaTable): EtaInfo {
  return etaFor(originOf(p), table);
}

/** "4 أيام عمل" / "7–12 يوم" */
export function etaDuration(e: EtaInfo, isAr: boolean): string {
  const { min, max, unit } = e.rule;
  const n = min === max ? `${max}` : `${min}–${max}`;
  if (isAr) {
    if (unit === 'work') return max === 1 ? 'يوم عمل' : `${n} أيام عمل`;
    return max === 1 ? 'يوم' : `${n} ${max <= 10 ? 'أيام' : 'يوم'}`;
  }
  return `${n} ${unit === 'work' ? 'working days' : 'days'}`;
}

/** "الأحد 26 أكتوبر" or "26–31 أكتوبر" */
export function etaDates(e: EtaInfo, isAr: boolean): string {
  const loc = isAr ? 'ar-OM-u-nu-latn' : 'en-GB';
  const day = (d: Date) => d.toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long' });
  const short = (d: Date) => d.toLocaleDateString(loc, { day: 'numeric', month: 'long' });
  if (e.from.toDateString() === e.to.toDateString()) return day(e.to);
  return `${short(e.from)} – ${short(e.to)}`;
}

export const ORIGIN_LABEL: Record<Origin, { ar: string; en: string }> = {
  oman: { ar: 'متوفرة في عُمان', en: 'In stock in Oman' },
  dubai: { ar: 'تُشحن من دبي', en: 'Ships from Dubai' },
  europe: { ar: 'تُشحن من أوروبا', en: 'Ships from Europe' },
};
