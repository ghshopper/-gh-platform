import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { api } from './api';

/**
 * The owner's on/off switches (لوحة التحكم → المميزات), from GET /app/features.
 * Loaded at start and every time the app comes back to the foreground;
 * every piece of a feature that is off stays hidden.
 */
export interface FeatureMap {
  wishlist_alerts: { on: boolean };
  quotes: { on: boolean; expires_days?: number };
  smart_push: { on: boolean };
  wallet: { on: boolean; points_convert?: boolean; topup?: boolean; topup_min?: number; topup_max?: number };
  gifts: { on: boolean; wrap?: boolean; wrap_fee?: number };
  vip_progress: { on: boolean };
  purchase_photos: { on: boolean };
  reviews: { on: boolean; service?: boolean };
  chat: { on: boolean; welcome_ar?: string; welcome_en?: string; hours_ar?: string; hours_en?: string };
  weekly_new: { on: boolean; days?: number; max?: number; title_ar?: string; title_en?: string };
}

export type FeatureKey = keyof FeatureMap;

// The contract's defaults, used until the server answers (and offline with no cache).
const DEFAULTS: FeatureMap = {
  wishlist_alerts: { on: true },
  quotes: { on: false, expires_days: 3 },
  smart_push: { on: true },
  wallet: { on: false, points_convert: true, topup: true, topup_min: 5, topup_max: 1000 },
  gifts: { on: true, wrap: true, wrap_fee: 2 },
  vip_progress: { on: true },
  purchase_photos: { on: true },
  reviews: { on: true, service: true },
  chat: { on: false },
  weekly_new: { on: false, days: 7, max: 20, title_ar: 'جديدنا هذا الأسبوع', title_en: 'New this week' },
};

const CACHE = 'app_features_v1';

function truthy(v: unknown): boolean {
  return v === true || v === 1 || v === '1' || v === 'true';
}

/** Accept the bare object, {data: …} or {features: …}; unknown keys are ignored. */
function parse(raw: unknown): FeatureMap | null {
  if (!raw || typeof raw !== 'object') return null;
  let o = raw as Record<string, unknown>;
  if (o.data && typeof o.data === 'object' && !('wallet' in o)) o = o.data as Record<string, unknown>;
  if (o.features && typeof o.features === 'object' && !('wallet' in o)) o = o.features as Record<string, unknown>;
  const out = { ...DEFAULTS } as Record<string, Record<string, unknown>>;
  let any = false;
  for (const k of Object.keys(DEFAULTS)) {
    const v = o[k];
    if (v && typeof v === 'object') {
      any = true;
      const merged: Record<string, unknown> = { ...(DEFAULTS as unknown as Record<string, Record<string, unknown>>)[k], ...(v as Record<string, unknown>) };
      merged.on = truthy(merged.on);
      out[k] = merged;
    } else if (typeof v === 'boolean' || typeof v === 'number') {
      any = true;
      out[k] = { ...(DEFAULTS as unknown as Record<string, Record<string, unknown>>)[k], on: truthy(v) };
    }
  }
  return any ? (out as unknown as FeatureMap) : null;
}

interface Ctx {
  features: FeatureMap;
  reload: () => Promise<void>;
}

const FeaturesCtx = createContext<Ctx | null>(null);

export function FeaturesProvider({ children }: { children: ReactNode }) {
  const [features, setFeatures] = useState<FeatureMap>(DEFAULTS);

  const reload = useCallback(async () => {
    try {
      const f = parse(await api.get<unknown>('/app/features'));
      if (f) {
        setFeatures(f);
        AsyncStorage.setItem(CACHE, JSON.stringify(f)).catch(() => undefined);
      }
    } catch {
      // offline: keep the cached switches
    }
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(CACHE)
      .then((raw) => {
        const f = raw ? parse(JSON.parse(raw)) : null;
        if (f) setFeatures(f);
      })
      .catch(() => undefined)
      .finally(() => {
        reload().catch(() => undefined);
      });
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') reload().catch(() => undefined);
    });
    return () => sub.remove();
  }, [reload]);

  const value = useMemo(() => ({ features, reload }), [features, reload]);
  return <FeaturesCtx.Provider value={value}>{children}</FeaturesCtx.Provider>;
}

export function useFeatures(): FeatureMap {
  return useContext(FeaturesCtx)?.features ?? DEFAULTS;
}

export function useFeaturesReload(): () => Promise<void> {
  return useContext(FeaturesCtx)?.reload ?? (async () => undefined);
}

/** One feature's switch and settings: `useFeature('wallet').on`. */
export function useFeature<K extends FeatureKey>(key: K): FeatureMap[K] {
  return useFeatures()[key];
}
