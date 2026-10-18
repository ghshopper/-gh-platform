import AsyncStorage from '@react-native-async-storage/async-storage';
import { reloadAppAsync } from 'expo';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { I18nManager } from 'react-native';
import type { Lang } from './types';

interface LangCtx {
  lang: Lang;
  isAr: boolean;
  setLang: (l: Lang) => void;
  /** Pick the Arabic or English wording. */
  tr: (ar: string, en: string) => string;
  /** obj.name_ar / obj.name_en with a fallback to the other language. */
  pick: (obj: object | null | undefined, field: string) => string;
  /**
   * Arabic lays the whole app out right-to-left natively (I18nManager).
   * Only if the system refused the switch do screens fall back to a
   * JS-level `direction` style, and this is that style.
   */
  dir: { direction?: 'rtl' | 'ltr' };
}

const Ctx = createContext<LangCtx | null>(null);
const KEY = 'app_lang';
const ATTEMPT = 'app_rtl_attempt';

/**
 * Make the native layout direction match the language. Returns true when the
 * app is about to reload to apply it. Tries once per language, so a device
 * that refuses never loops.
 */
async function matchDirection(l: Lang): Promise<boolean> {
  const want = l === 'ar';
  if (I18nManager.isRTL === want) {
    AsyncStorage.removeItem(ATTEMPT).catch(() => undefined);
    return false;
  }
  const tried = await AsyncStorage.getItem(ATTEMPT).catch(() => null);
  if (tried === l) return false;
  await AsyncStorage.setItem(ATTEMPT, l).catch(() => undefined);
  I18nManager.allowRTL(want);
  I18nManager.forceRTL(want);
  try {
    await reloadAppAsync('layout direction');
    return true;
  } catch {
    return false;
  }
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const v = await AsyncStorage.getItem(KEY).catch(() => null);
      const l: Lang = v === 'en' ? 'en' : 'ar';
      if (await matchDirection(l)) return;
      if (alive) setLangState(l);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const setLang = useCallback((l: Lang) => {
    (async () => {
      await AsyncStorage.setItem(KEY, l).catch(() => undefined);
      if (await matchDirection(l)) return;
      setLangState(l);
    })();
  }, []);

  const value = useMemo<LangCtx | null>(() => {
    if (!lang) return null;
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
      dir: I18nManager.isRTL === isAr ? {} : { direction: isAr ? 'rtl' : 'ltr' },
    };
  }, [lang, setLang]);

  // Nothing renders until the language (and its direction) is settled; the
  // splash screen stays up meanwhile.
  if (!value) return null;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLang(): LangCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useLang outside LangProvider');
  return v;
}
