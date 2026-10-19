import { DEFAULT_ETA, type EtaTable } from './eta';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { GENACOM_BRANCHES, type GenacomBranch } from './genacom';
import { api, ApiError, hasToken, listOf, setToken, setUnauthorizedHandler } from './api';
import { num } from './format';
import type { Brand, CartItem, Category, DeliveryOptions, HomeConfig, Policy, Product, User } from './types';

/* ------------------------------- App data ------------------------------- */

interface AppData {
  home: HomeConfig | null;
  categories: Category[];
  brands: Brand[];
  serviceFee: number;
  taxPercent: number;
  delivery: DeliveryOptions;
  policies: Policy[];
  ready: boolean;
}

const DataCtx = createContext<AppData | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [d, setD] = useState<AppData>(() => {
    try {
      const raw = sessionStorage.getItem('gh_data');
      if (raw) return { ...(JSON.parse(raw) as AppData), ready: true };
    } catch {
      // ignore
    }
    return { home: null, categories: [], brands: [], serviceFee: 0, taxPercent: 0, delivery: { home_fee: 2, branch_fee: 1, branches: GENACOM_BRANCHES }, policies: [], ready: false };
  });

  useEffect(() => {
    (async () => {
      const [home, cats, brands, settings, delivery, fp] = await Promise.allSettled([
        api.get<{ data?: HomeConfig }>('/app/home-config'),
        api.get<unknown>('/customer/categories'),
        api.get<unknown>('/customer/brands'),
        api.get<{ data?: Record<string, unknown> }>('/app/settings', { group: 'general' }),
        api.get<DeliveryOptions>('/ps/delivery-options'),
        api.get<{ policies?: Policy[] }>('/app/footer-policies'),
      ]);
      setD((prev) => {
        const next = { ...prev, ready: true };
        if (home.status === 'fulfilled' && home.value?.data) next.home = home.value.data;
        if (cats.status === 'fulfilled') next.categories = listOf<Category>(cats.value);
        if (brands.status === 'fulfilled') next.brands = listOf<Brand>(brands.value);
        if (settings.status === 'fulfilled') {
          const s = settings.value?.data ?? {};
          next.serviceFee = num(s.service_fee);
          next.taxPercent = num(s.tax_percentage);
        }
        if (delivery.status === 'fulfilled' && delivery.value) {
          const gb = (delivery.value as { genacom_branches?: unknown }).genacom_branches;
          const eta = (delivery.value as { eta?: unknown }).eta;
          next.delivery = {
            home_fee: num(delivery.value.home_fee, 2),
            branch_fee: num(delivery.value.branch_fee, 1),
            branches: Array.isArray(gb) ? (gb as GenacomBranch[]) : GENACOM_BRANCHES,
            eta: eta && typeof eta === 'object' ? { ...DEFAULT_ETA, ...(eta as Partial<EtaTable>) } : DEFAULT_ETA,
          };
        }
        if (fp.status === 'fulfilled') next.policies = fp.value?.policies ?? [];
        try {
          sessionStorage.setItem('gh_data', JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    })();
  }, []);

  return <DataCtx.Provider value={d}>{children}</DataCtx.Provider>;
}

export function useData(): AppData {
  const v = useContext(DataCtx);
  if (!v) throw new Error('useData outside provider');
  return v;
}

/* --------------------------------- Auth --------------------------------- */

interface Auth {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, phone: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthCtx = createContext<Auth | null>(null);
interface LoginResponse {
  token?: string;
  access_token?: string;
  user?: User;
  message?: string;
  data?: { token?: string; user?: User };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (!hasToken()) {
      setUser(null);
      return;
    }
    try {
      const r = await api.get<{ user?: User; data?: User } & User>('/auth/me');
      setUser(r?.user ?? r?.data ?? (r?.id ? r : null));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setToken(null);
        setUser(null);
      }
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null);
      setUser(null);
    });
    refresh().finally(() => setReady(true));
  }, [refresh]);

  const finish = useCallback(
    async (r: LoginResponse, fallback: string) => {
      const t = r?.token ?? r?.access_token ?? r?.data?.token;
      if (!t) throw new Error(r?.message || fallback);
      setToken(t);
      const u = r.user ?? r.data?.user;
      if (u) setUser(u);
      await refresh();
    },
    [refresh],
  );

  const value = useMemo<Auth>(
    () => ({
      user,
      ready,
      refresh,
      login: async (email, password) => finish(await api.post<LoginResponse>('/auth/login', { email: email.trim(), password }), 'البريد الإلكتروني أو كلمة المرور غير صحيحة'),
      register: async (name, email, phone, password) =>
        finish(
          await api.post<LoginResponse>('/auth/register', { name: name.trim(), email: email.trim(), phone: phone.trim(), password, password_confirmation: password }),
          'تعذّر إنشاء الحساب',
        ),
      logout: () => {
        api.post('/auth/logout').catch(() => undefined);
        setToken(null);
        setUser(null);
      },
    }),
    [user, ready, refresh, finish],
  );
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): Auth {
  const v = useContext(AuthCtx);
  if (!v) throw new Error('useAuth outside provider');
  return v;
}

/* --------------------------------- Cart --------------------------------- */

export interface AppliedCoupon {
  code: string;
  discount: number;
}

interface Cart {
  items: CartItem[];
  count: number;
  subtotal: number;
  add: (item: Omit<CartItem, 'key' | 'quantity'>, quantity?: number) => void;
  setQuantity: (key: string, q: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  coupon: AppliedCoupon | null;
  couponNote: string | null;
  applyCoupon: (code: string) => Promise<AppliedCoupon>;
  removeCoupon: () => void;
  recheckCoupon: (phone?: string) => Promise<AppliedCoupon | null>;
  open: boolean;
  setOpen: (o: boolean) => void;
}

const CartCtx = createContext<Cart | null>(null);
export const cartKey = (id: number, options: { label: string; value: string }[]) => [id, ...options.map((o) => `${o.label}:${o.value}`)].join('|');

async function checkCode(code: string, items: CartItem[], phone?: string): Promise<AppliedCoupon> {
  const r = await api.post<{ valid?: boolean; discount?: number | string; message?: string; code?: string | null }>('/customer/coupons/validate', {
    code: code.trim(),
    phone: phone || undefined,
    items: items.map((i) => ({ product_id: i.productId, price: i.price, quantity: i.quantity })),
  });
  if (!r?.valid) throw new ApiError(r?.message || 'كود الخصم غير صالح', 422);
  return { code: r.code || code.trim().toUpperCase(), discount: Number(r.discount) || 0 };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem('gh_cart');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [open, setOpen] = useState(false);
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const [couponNote, setCouponNote] = useState<string | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const couponRef = useRef(coupon);
  couponRef.current = coupon;

  useEffect(() => {
    try {
      localStorage.setItem('gh_cart', JSON.stringify(items));
    } catch {
      // ignore
    }
  }, [items]);

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

  useEffect(() => {
    if (!couponRef.current) return;
    if (!items.length) {
      setCoupon(null);
      return;
    }
    const t = setTimeout(() => recheckCoupon().catch(() => undefined), 500);
    return () => clearTimeout(t);
  }, [items, recheckCoupon]);

  const value = useMemo<Cart>(
    () => ({
      items,
      count: items.reduce((s, x) => s + x.quantity, 0),
      subtotal: items.reduce((s, x) => s + x.price * x.quantity, 0),
      add: (item, quantity = 1) => {
        const key = cartKey(item.productId, item.options);
        setItems((prev) => {
          const i = prev.findIndex((x) => x.key === key);
          if (i >= 0) return prev.map((x, k) => (k === i ? { ...x, quantity: x.quantity + quantity } : x));
          return [...prev, { ...item, key, quantity }];
        });
      },
      setQuantity: (key, q) => setItems((prev) => (q <= 0 ? prev.filter((x) => x.key !== key) : prev.map((x) => (x.key === key ? { ...x, quantity: q } : x)))),
      remove: (key) => setItems((prev) => prev.filter((x) => x.key !== key)),
      clear: () => {
        setItems([]);
        setCoupon(null);
        setCouponNote(null);
      },
      coupon,
      couponNote,
      applyCoupon: async (code) => {
        const c = await checkCode(code, itemsRef.current);
        setCoupon(c);
        setCouponNote(null);
        return c;
      },
      removeCoupon: () => {
        setCoupon(null);
        setCouponNote(null);
      },
      recheckCoupon,
      open,
      setOpen,
    }),
    [items, coupon, couponNote, recheckCoupon, open],
  );
  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

export function useCart(): Cart {
  const v = useContext(CartCtx);
  if (!v) throw new Error('useCart outside provider');
  return v;
}

/* ------------------------------- Wishlist ------------------------------- */

interface Wish {
  products: Product[];
  has: (id: number) => boolean;
  toggle: (p: Product) => Promise<boolean>;
}
const WishCtx = createContext<Wish | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const load = useCallback(async () => {
    if (!user) {
      setProducts([]);
      return;
    }
    try {
      const rows = listOf<{ product?: Product | null }>(await api.get<unknown>('/customer/wishlist'));
      setProducts(rows.map((r) => r.product).filter((p): p is Product => !!p));
    } catch {
      // keep
    }
  }, [user]);
  useEffect(() => {
    load();
  }, [load]);
  const value = useMemo<Wish>(() => {
    const ids = new Set(products.map((p) => p.id));
    return {
      products,
      has: (id) => ids.has(id),
      toggle: async (p) => {
        if (!user) return false;
        const on = ids.has(p.id);
        setProducts((prev) => (on ? prev.filter((x) => x.id !== p.id) : [...prev, p]));
        try {
          await api.post('/customer/wishlist/toggle', { product_id: p.id });
        } catch {
          load();
        }
        return true;
      },
    };
  }, [products, user, load]);
  return <WishCtx.Provider value={value}>{children}</WishCtx.Provider>;
}

export function useWishlist(): Wish {
  const v = useContext(WishCtx);
  if (!v) throw new Error('useWishlist outside provider');
  return v;
}

/* --------------------------------- Toast -------------------------------- */

type ToastFn = (text: string, action?: { label: string; to: string }) => void;
const ToastCtx = createContext<{ show: ToastFn; toast: { text: string; action?: { label: string; to: string } } | null } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ text: string; action?: { label: string; to: string } } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback<ToastFn>((text, action) => {
    setToast({ text, action });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 3200);
  }, []);
  return <ToastCtx.Provider value={{ show, toast }}>{children}</ToastCtx.Provider>;
}

export function useToast() {
  const v = useContext(ToastCtx);
  if (!v) throw new Error('useToast outside provider');
  return v;
}
