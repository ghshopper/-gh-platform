import type { Product } from './types';

// Products seen in lists, so the product page opens instantly (and still
// opens if the details request fails).
const seen = new Map<number, Product>();

export function rememberProduct(p: Product): void {
  seen.set(p.id, { ...seen.get(p.id), ...p });
}

export function knownProduct(id: number): Product | undefined {
  return seen.get(id);
}
