import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, listOf } from './api';
import { useAuth } from './auth';
import type { Product } from './types';

interface WishCtx {
  ids: Set<number>;
  products: Product[];
  has: (id: number) => boolean;
  /** Returns false when the visitor has to sign in first. */
  toggle: (p: Product) => Promise<boolean>;
  reload: () => Promise<void>;
}

const Ctx = createContext<WishCtx | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { loggedIn } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);

  const reload = useCallback(async () => {
    if (!loggedIn) {
      setProducts([]);
      return;
    }
    try {
      const rows = listOf<{ product?: Product | null }>(await api.get<unknown>('/customer/wishlist'));
      setProducts(rows.map((r) => r.product).filter((p): p is Product => !!p));
    } catch {
      // keep the last list
    }
  }, [loggedIn]);

  useEffect(() => {
    reload();
  }, [reload]);

  const toggle = useCallback(
    async (p: Product) => {
      if (!loggedIn) return false;
      const had = products.some((x) => x.id === p.id);
      setProducts((prev) => (had ? prev.filter((x) => x.id !== p.id) : [p, ...prev]));
      try {
        await api.post('/customer/wishlist/toggle', { product_id: p.id });
      } catch {
        setProducts((prev) => (had ? [p, ...prev] : prev.filter((x) => x.id !== p.id)));
      }
      return true;
    },
    [loggedIn, products],
  );

  const value = useMemo<WishCtx>(() => {
    const ids = new Set(products.map((p) => p.id));
    return { ids, products, has: (id) => ids.has(id), toggle, reload };
  }, [products, toggle, reload]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWishlist(): WishCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useWishlist outside WishlistProvider');
  return v;
}
