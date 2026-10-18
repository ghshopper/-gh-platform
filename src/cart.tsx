import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, ApiError } from './api';
import type { CartItem } from './types';

export interface AppliedCoupon {
  code: string;
  discount: number;
}

interface CouponCheck {
  valid?: boolean;
  discount?: number | string;
  message?: string;
  code?: string | null;
}

interface CartCtx {
  items: CartItem[];
  count: number;
  subtotal: number;
  add: (item: Omit<CartItem, 'key' | 'quantity'>, quantity?: number) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  /** Discount code; the server works the amount out again on the order. */
  coupon: AppliedCoupon | null;
  /** Message when a code stopped applying (basket changed, expired...). */
  couponNote: string | null;
  applyCoupon: (code: string) => Promise<AppliedCoupon>;
  removeCoupon: () => void;
  /** Check the code again right before paying. */
  recheckCoupon: (phone?: string) => Promise<AppliedCoupon | null>;
}

async function checkCode(code: string, items: CartItem[], phone?: string): Promise<AppliedCoupon> {
  const r = await api.post<CouponCheck>('/customer/coupons/validate', {
    code: code.trim(),
    phone: phone || undefined,
    items: items.map((i) => ({ product_id: i.productId, price: i.price, quantity: i.quantity })),
  });
  if (!r?.valid) throw new ApiError(r?.message || 'كود الخصم غير صالح', 422);
  return { code: r.code || code.trim().toUpperCase(), discount: Number(r.discount) || 0 };
}

const Ctx = createContext<CartCtx | null>(null);
const KEY = 'cart_v2';

export function cartKey(productId: number, options: { label: string; value: string }[]): string {
  return [productId, ...options.map((o) => `${o.label}:${o.value}`)].join('|');
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setItems(parsed as CartItem[]);
        }
      })
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(KEY, JSON.stringify(items)).catch(() => undefined);
  }, [items, loaded]);

  const add = useCallback<CartCtx['add']>((item, quantity = 1) => {
    const key = cartKey(item.productId, item.options);
    setItems((prev) => {
      const i = prev.findIndex((x) => x.key === key);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], quantity: next[i].quantity + quantity };
        return next;
      }
      return [...prev, { ...item, key, quantity }];
    });
  }, []);

  const setQuantity = useCallback((key: string, quantity: number) => {
    setItems((prev) =>
      quantity <= 0 ? prev.filter((x) => x.key !== key) : prev.map((x) => (x.key === key ? { ...x, quantity } : x)),
    );
  }, []);

  const remove = useCallback((key: string) => setItems((prev) => prev.filter((x) => x.key !== key)), []);
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const [couponNote, setCouponNote] = useState<string | null>(null);
  const couponRef = useRef<AppliedCoupon | null>(null);
  couponRef.current = coupon;
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const clear = useCallback(() => {
    setItems([]);
    setCoupon(null);
    setCouponNote(null);
  }, []);

  const applyCoupon = useCallback(async (code: string) => {
    const c = await checkCode(code, itemsRef.current);
    setCoupon(c);
    setCouponNote(null);
    return c;
  }, []);

  const removeCoupon = useCallback(() => {
    setCoupon(null);
    setCouponNote(null);
  }, []);

  const recheckCoupon = useCallback(async (phone?: string) => {
    const cur = couponRef.current;
    if (!cur) return null;
    try {
      const c = await checkCode(cur.code, itemsRef.current, phone);
      setCoupon(c);
      return c;
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        setCoupon(null);
        setCouponNote(e.message);
        return null;
      }
      throw e;
    }
  }, []);

  // The amount depends on what is in the bag, so follow changes.
  useEffect(() => {
    if (!couponRef.current) return;
    if (!items.length) {
      setCoupon(null);
      return;
    }
    const t = setTimeout(() => recheckCoupon(undefined).catch(() => undefined), 500);
    return () => clearTimeout(t);
  }, [items, recheckCoupon]);

  const value = useMemo<CartCtx>(
    () => ({
      items,
      count: items.reduce((s, x) => s + x.quantity, 0),
      subtotal: items.reduce((s, x) => s + x.price * x.quantity, 0),
      add,
      setQuantity,
      remove,
      clear,
      coupon,
      couponNote,
      applyCoupon,
      removeCoupon,
      recheckCoupon,
    }),
    [items, add, setQuantity, remove, clear, coupon, couponNote, applyCoupon, removeCoupon, recheckCoupon],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart(): CartCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useCart outside CartProvider');
  return v;
}
