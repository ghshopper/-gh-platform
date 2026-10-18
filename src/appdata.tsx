import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, listOf } from './api';
import { num } from './format';
import type { Brand, Category, DeliveryOptions, HomeConfig, Policy } from './types';

/** Things every screen may need, fetched once and cached for offline starts. */
interface AppData {
  home: HomeConfig | null;
  categories: Category[];
  brands: Brand[];
  serviceFee: number;
  taxPercent: number;
  delivery: DeliveryOptions;
  policies: Policy[];
  footer: Record<string, unknown> | null;
  reload: () => Promise<void>;
}

const Ctx = createContext<AppData | null>(null);
const CACHE = 'app_data_v1';
const DEFAULT_DELIVERY: DeliveryOptions = { home_fee: 2, branch_fee: 1 };

type Snapshot = Omit<AppData, 'reload'>;

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Snapshot>({
    home: null,
    categories: [],
    brands: [],
    serviceFee: 0,
    taxPercent: 0,
    delivery: DEFAULT_DELIVERY,
    policies: [],
    footer: null,
  });

  const reload = useCallback(async () => {
    const [home, cats, brands, settings, delivery, fp] = await Promise.allSettled([
      api.get<{ success?: boolean; data?: HomeConfig }>('/app/home-config'),
      api.get<unknown>('/customer/categories'),
      api.get<unknown>('/customer/brands'),
      api.get<{ data?: Record<string, unknown> }>('/app/settings', { group: 'general' }),
      api.get<DeliveryOptions>('/ps/delivery-options'),
      api.get<{ footer?: Record<string, unknown> | null; policies?: Policy[] }>('/app/footer-policies'),
    ]);
    setData((prev) => {
      const next: Snapshot = { ...prev };
      if (home.status === 'fulfilled' && home.value?.data) next.home = home.value.data;
      if (cats.status === 'fulfilled') next.categories = listOf<Category>(cats.value);
      if (brands.status === 'fulfilled') next.brands = listOf<Brand>(brands.value);
      if (settings.status === 'fulfilled') {
        const s = settings.value?.data ?? {};
        next.serviceFee = num(s.service_fee);
        next.taxPercent = num(s.tax_percentage);
      }
      if (delivery.status === 'fulfilled' && delivery.value) {
        next.delivery = {
          home_fee: num(delivery.value.home_fee, DEFAULT_DELIVERY.home_fee),
          branch_fee: num(delivery.value.branch_fee, DEFAULT_DELIVERY.branch_fee),
        };
      }
      if (fp.status === 'fulfilled') {
        next.policies = fp.value?.policies ?? [];
        next.footer = fp.value?.footer ?? null;
      }
      AsyncStorage.setItem(CACHE, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(CACHE)
      .then((raw) => {
        if (raw) setData((prev) => ({ ...prev, ...(JSON.parse(raw) as Partial<Snapshot>) }));
      })
      .catch(() => undefined)
      .finally(() => {
        reload().catch(() => undefined);
      });
  }, [reload]);

  const value = useMemo<AppData>(() => ({ ...data, reload }), [data, reload]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppData(): AppData {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAppData outside AppDataProvider');
  return v;
}
