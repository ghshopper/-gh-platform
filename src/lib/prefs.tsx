import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Lang } from './types';

export type ThemeMode = 'system' | 'light' | 'dark';

interface Prefs {
  lang: Lang;
  isAr: boolean;
  setLang: (l: Lang) => void;
  tr: (ar: string, en: string) => string;
  pick: (obj: object | null | undefined, field: string) => string;
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
}

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
    };
  }, [lang, setLang, theme, setTheme]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs(): Prefs {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePrefs outside provider');
  return v;
}
