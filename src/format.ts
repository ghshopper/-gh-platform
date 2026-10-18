import type { Product, ProductAttribute } from './types';

export function num(v: unknown, fallback = 0): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : fallback;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

/** OMR with three decimals, Latin digits: "OMR 825.000". */
export function omr(v: unknown): string {
  return `OMR ${num(v).toFixed(3)}`;
}

/** The price the customer pays (sale price when set). */
export function productPrice(p: Product): number {
  const sale = num(p.sale_price, 0);
  return sale > 0 ? sale : num(p.price);
}

/** The crossed-out price, only when it is higher than what they pay. */
export function productWasPrice(p: Product): number | null {
  const price = productPrice(p);
  const base = num(p.price);
  const compare = num(p.compare_price, 0);
  const was = Math.max(compare, num(p.sale_price, 0) > 0 ? base : 0);
  return was > price ? was : null;
}

function parseJsonList<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (typeof v === 'string' && v.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function productImages(p: Product): string[] {
  const list: string[] = [];
  if (p.primary_image) list.push(p.primary_image);
  for (const g of parseJsonList<string>(p.gallery_images)) if (g && !list.includes(g)) list.push(g);
  for (const i of p.images ?? []) if (i.image_path && !list.includes(i.image_path)) list.push(i.image_path);
  return list;
}

export function productAttributes(p: Product): ProductAttribute[] {
  return parseJsonList<ProductAttribute>(p.attributes).filter((a) => (a.values ?? []).length > 0);
}

export function inStock(p: Product): boolean {
  return p.stock_quantity === undefined || p.stock_quantity === null || num(p.stock_quantity) > 0;
}

export function dateText(iso?: string | null, isAr = true): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleDateString(isAr ? 'ar-OM-u-nu-latn' : 'en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Muscat',
    });
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/** Oman numbers: keep digits, convert Arabic-Indic digits, add 968 if local. */
export function waNumber(phone?: string | null): string | null {
  if (!phone) return null;
  const latin = phone.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  let digits = latin.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 8) digits = `968${digits}`;
  return digits.length >= 8 ? digits : null;
}
