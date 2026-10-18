import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { applyPalette, C } from './theme';

export type ThemeMode = 'system' | 'light' | 'dark';

interface AppearanceCtx {
  mode: ThemeMode;
  dark: boolean;
  setMode: (m: ThemeMode) => void;
}

const Ctx = createContext<AppearanceCtx | null>(null);
const KEY = 'app_theme';

/**
 * Light / dark / follow the phone. Colours live in the shared `C` object, so
 * a change swaps the palette and remounts the screens under this provider
 * (cart, sign-in and language above it are kept), then returns to Account
 * where the switch is.
 */
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode | null>(null);
  const backToAccount = useRef(false);
  const systemRef = useRef(system);
  systemRef.current = system;

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        const m: ThemeMode = v === 'light' || v === 'dark' ? v : 'system';
        if (m !== 'system') Appearance.setColorScheme?.(m);
        setModeState(m);
      })
      .catch(() => setModeState('system'));
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    const nextDark = m === 'dark' || (m === 'system' && systemRef.current === 'dark');
    backToAccount.current = nextDark !== C.bg.startsWith('#0');
    Appearance.setColorScheme?.(m === 'system' ? 'unspecified' : m);
    setModeState(m);
    AsyncStorage.setItem(KEY, m).catch(() => undefined);
  }, []);

  const dark = mode === 'dark' || (mode === 'system' && system === 'dark');
  // Swap before anything below renders with the new colours.
  applyPalette(dark);

  useEffect(() => {
    if (!backToAccount.current) return;
    backToAccount.current = false;
    const t = setTimeout(() => {
      try {
        router.navigate('/account');
      } catch {
        // Navigation not mounted yet; staying on home is fine.
      }
    }, 0);
    return () => clearTimeout(t);
  }, [dark]);

  const value = useMemo<AppearanceCtx | null>(() => (mode ? { mode, dark, setMode } : null), [mode, dark, setMode]);
  if (!value) return null;
  return (
    <Ctx.Provider value={value}>
      <Fragment key={dark ? 'dark' : 'light'}>{children}</Fragment>
    </Ctx.Provider>
  );
}

export function useAppearance(): AppearanceCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAppearance outside AppearanceProvider');
  return v;
}
