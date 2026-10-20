import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Where the customer is (Oman or another Gulf country) and the currency we
 * show prices in. Only a display: every payment is in Omani rials (Amwal).
 * Module state so `omr()` everywhere can read it; LangProvider re-renders the
 * app when it changes.
 */
export interface GccCountry {
  code: string;
  name_ar: string;
  name_en: string;
  currency: string;
  symbol_ar: string;
  symbol_en: string;
  dial: string;
  digits: number;
  decimals: number;
  rate: number;
  fee: number;
}
export interface GccConfig {
  enabled: boolean;
  fee?: number;
  eta?: { min: number; max: number; unit: 'work' | 'days' };
  carrier?: string;
  carrier_name?: string;
  show_currency?: boolean;
  note_ar?: string;
  note_en?: string;
  countries: GccCountry[];
}

export const OMAN = { code: 'OM', name_ar: 'عُمان', name_en: 'Oman', dial: '968', digits: 8, currency: 'OMR' };
export const FLAG: Record<string, string> = { OM: '🇴🇲', SA: '🇸🇦', AE: '🇦🇪', KW: '🇰🇼', QA: '🇶🇦', BH: '🇧🇭' };

const KEY = 'app_country';
let config: GccConfig = { enabled: false, countries: [] };
let country = 'OM';
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((f) => f());

export function onRegionChange(f: () => void): () => void {
  listeners.add(f);
  return () => {
    listeners.delete(f);
  };
}

AsyncStorage.getItem(KEY)
  .then((v) => {
    if (v && v !== country) {
      country = v;
      changed();
    }
  })
  .catch(() => undefined);

export function setGccConfig(c: GccConfig | null | undefined) {
  const next = c && c.enabled ? c : { enabled: false, countries: [] };
  if (JSON.stringify(next) === JSON.stringify(config)) return;
  config = next;
  changed();
}
export function gccConfig(): GccConfig {
  return config;
}
export function setCountryCode(code: string) {
  country = code || 'OM';
  AsyncStorage.setItem(KEY, country).catch(() => undefined);
  changed();
}
/** The chosen country when we ship there now; otherwise Oman. */
export function countryCode(): string {
  return country !== 'OM' && config.enabled && config.countries.some((c) => c.code === country) ? country : 'OM';
}
export function gccCountry(code = countryCode()): GccCountry | null {
  return code === 'OM' ? null : config.countries.find((c) => c.code === code) ?? null;
}

export function omrExact(v: number): string {
  return `OMR ${(Number.isFinite(v) ? v : 0).toFixed(3)}`;
}

/** A price in the customer's currency ("SAR 8,046"), or OMR in Oman. */
export function displayMoney(v: number): string {
  const c = gccCountry();
  if (!c || config.show_currency === false) return omrExact(v);
  const n = (Number.isFinite(v) ? v : 0) * c.rate;
  const s = n.toFixed(c.decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${c.currency} ${s}`;
}

export function showingOtherCurrency(): boolean {
  return !!gccCountry() && config.show_currency !== false;
}

/** Extra Gulf shipping days when the customer is outside Oman. */
export function gulfEta(): { min: number; max: number } | null {
  return gccCountry() && config.eta ? { min: config.eta.min, max: config.eta.max } : null;
}
