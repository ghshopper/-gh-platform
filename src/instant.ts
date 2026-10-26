import { useEffect, useState } from 'react';
import { api } from './api';
import type { Category, Paginated, Product } from './types';

/** The "ready to deliver" shelf, shown first among the categories when it has pieces. */
export const INSTANT_ID = -1;
export const INSTANT_CATEGORY = { id: INSTANT_ID, name_ar: 'تسليم فوري', name_en: 'Ready to deliver', children: [] } as unknown as Category;

let cached: number | null = null;

/** How many pieces are ready to deliver now (null while loading). */
export function useInstantCount(): number | null {
  const [n, setN] = useState<number | null>(cached);
  useEffect(() => {
    let alive = true;
    api.get<Paginated<Product>>('/customer/products', { instant: 1, per_page: 1 })
      .then((r) => { cached = Number(r?.total ?? 0); if (alive) setN(cached); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, []);
  return n;
}

export function openInstant(router: { push: (a: { pathname: string; params: Record<string, string> }) => void }, title: string) {
  router.push({ pathname: '/products', params: { instant: '1', title } });
}
