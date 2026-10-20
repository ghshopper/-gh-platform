/**
 * Where the customer is (Oman or another Gulf country) and the currency we
 * show prices in. Only a display: every payment is in Omani rials (Amwal).
 * Kept in a module so `omr()` everywhere can read it; PrefsProvider re-renders
 * the site when it changes.
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

export const OMAN = { code: 'OM', name_ar: 'عُمان', name_en: 'Oman', dial: '968', digits: 8 };

let config: GccConfig = { enabled: false, countries: [] };
let country = 'OM';
const KEY = 'gh_country';

// First visit: guess the country from the device's time zone (only used
// once Gulf shipping is on; the customer can change it any time).
const TZ: Record<string, string> = { 'Asia/Riyadh': 'SA', 'Asia/Kuwait': 'KW', 'Asia/Qatar': 'QA', 'Asia/Bahrain': 'BH' } // not Asia/Dubai: Oman shares it;
try {
  const v = localStorage.getItem(KEY);
  if (v) country = v;
  else country = TZ[Intl.DateTimeFormat().resolvedOptions().timeZone] ?? 'OM';
} catch {
  // ignore
}

const changed = () => {
  try {
    window.dispatchEvent(new Event('gh-region'));
  } catch {
    // ignore
  }
};

export function setGccConfig(c: GccConfig | null | undefined) {
  config = c && c.enabled ? c : { enabled: false, countries: [] };
  changed();
}
export function gccConfig(): GccConfig {
  return config;
}
export function setCountryCode(code: string) {
  country = code || 'OM';
  try {
    localStorage.setItem(KEY, country);
  } catch {
    // ignore
  }
  changed();
}
/** The chosen country when we ship there now; otherwise Oman. */
export function countryCode(): string {
  return country !== 'OM' && config.enabled && config.countries.some((c) => c.code === country) ? country : 'OM';
}
export function gccCountry(code = countryCode()): GccCountry | null {
  return code === 'OM' ? null : config.countries.find((c) => c.code === code) ?? null;
}

/** OMR with three decimals, Latin digits: "OMR 825.000" (what is charged). */
export function omrExact(v: number): string {
  return `OMR ${(Number.isFinite(v) ? v : 0).toFixed(3)}`;
}

/** A price in the customer's currency ("SAR 8,046"), or OMR in Oman. */
export function displayMoney(v: number): string {
  const c = gccCountry();
  if (!c || config.show_currency === false) return omrExact(v);
  const n = (Number.isFinite(v) ? v : 0) * c.rate;
  return `${c.currency} ${n.toLocaleString('en-US', { minimumFractionDigits: c.decimals, maximumFractionDigits: c.decimals })}`;
}

/** True when prices on screen are not in OMR (so the charge line is worth showing). */
export function showingOtherCurrency(): boolean {
  return !!gccCountry() && config.show_currency !== false;
}

/** Extra Gulf shipping days when the customer is outside Oman. */
export function gulfEta(): { min: number; max: number } | null {
  return gccCountry() && config.eta ? { min: config.eta.min, max: config.eta.max } : null;
}
