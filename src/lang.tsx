import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Lang } from './types';

interface LangCtx {
  lang: Lang;
  isAr: boolean;
  setLang: (l: Lang) => void;
  /** Pick the Arabic or English wording. */
  tr: (ar: string, en: string) => string;
  /** obj.name_ar / obj.name_en with a fallback to the other language. */
  pick: (obj: object | null | undefined, field: string) => string;
}

const Ctx = createContext<LangCtx | null>(null);
const KEY = 'app_lang';

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('ar');

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (v === 'ar' || v === 'en') setLangState(v);
      })
      .catch(() => undefined);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem(KEY, l).catch(() => undefined);
  }, []);

  const value = useMemo<LangCtx>(() => {
    const isAr = lang === 'ar';
    return {
      lang,
      isAr,
      setLang,
      tr: (ar, en) => (isAr ? ar : en),
      pick: (obj, field) => {
        if (!obj) return '';
        const o = obj as Record<string, unknown>;
        const first = o[`${field}_${lang}`];
        const other = o[`${field}_${isAr ? 'en' : 'ar'}`];
        const plain = o[field];
        for (const v of [first, other, plain]) {
          if (typeof v === 'string' && v.trim()) return v.trim();
        }
        return '';
      },
    };
  }, [lang, setLang]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLang(): LangCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useLang outside LangProvider');
  return v;
}
