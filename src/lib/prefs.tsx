import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Lang } from './types';
import { countryCode, setCountryCode } from './region';

export type ThemeMode = 'system' | 'light' | 'dark';

interface Prefs {
  lang: Lang;
  isAr: boolean;
  setLang: (l: Lang) => void;
  tr: (ar: string, en: string) => string;
  pick: (obj: object | null | undefined, field: string) => string;
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  /** Women's / men's shopping ('' = everything). */
  gender: Gender;
  setGender: (g: Gender) => void;
  /** 'OM' or a Gulf country we ship to (prices shown in its currency). */
  country: string;
  setCountry: (code: string) => void;
}

export type Gender = '' | 'women' | 'men';

const Ctx = createContext<Prefs | null>(null);
const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    // ignore
  }
};

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (read('gh_lang') === 'en' ? 'en' : 'ar'));
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const t = read('gh_theme');
    return t === 'light' || t === 'dark' ? t : 'system';
  });

  const [gender, setGenderState] = useState<Gender>(() => {
    const g = read('gh_gender');
    return g === 'women' || g === 'men' ? g : '';
  });

  // the country/currency lives in lib/region; this re-renders the site when it changes
  const [country, setCountryState] = useState(countryCode);
  useEffect(() => {
    const on = () => setCountryState(countryCode());
    window.addEventListener('gh-region', on);
    on(); // the Gulf settings may have arrived (from the cache) before we listened
    return () => window.removeEventListener('gh-region', on);
  }, []);
  const setCountry = useCallback((code: string) => setCountryCode(code), []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }, [theme]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    write('gh_lang', l);
  }, []);
  const setTheme = useCallback((t: ThemeMode) => {
    setThemeState(t);
    write('gh_theme', t);
  }, []);

  const setGender = useCallback((g: Gender) => {
    setGenderState(g);
    write('gh_gender', g);
  }, []);

  const value = useMemo<Prefs>(() => {
    const isAr = lang === 'ar';
    return {
      lang,
      isAr,
      setLang,
      tr: (ar, en) => (isAr ? ar : en),
      pick: (obj, field) => {
        if (!obj) return '';
        const o = obj as Record<string, unknown>;
        for (const v of [o[`${field}_${lang}`], o[`${field}_${isAr ? 'en' : 'ar'}`], o[field]]) {
          if (typeof v === 'string' && v.trim()) return v.trim();
        }
        return '';
      },
      theme,
      setTheme,
      gender,
      setGender,
      country,
      setCountry,
    };
  }, [lang, setLang, theme, setTheme, gender, setGender, country, setCountry]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs(): Prefs {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePrefs outside provider');
  return v;
}
