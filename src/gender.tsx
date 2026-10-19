import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { setListGender } from './api';
import { useLang } from './lang';
import { C } from './theme';
import { T } from './ui';

/** Women's / men's shopping ('' = everything), remembered on the phone. */
export type Gender = '' | 'women' | 'men';

const KEY = 'gh_gender';
const Ctx = createContext<{ gender: Gender; setGender: (g: Gender) => void }>({ gender: '', setGender: () => undefined });

export function GenderProvider({ children }: { children: ReactNode }) {
  const [gender, setState] = useState<Gender>('');
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (v === 'women' || v === 'men') {
          setListGender(v);
          setState(v);
        }
      })
      .catch(() => undefined);
  }, []);
  const setGender = useCallback((g: Gender) => {
    setListGender(g);
    setState(g);
    AsyncStorage.setItem(KEY, g).catch(() => undefined);
  }, []);
  const value = useMemo(() => ({ gender, setGender }), [gender, setGender]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useGender = () => useContext(Ctx);

export function GenderSwitch() {
  const { tr } = useLang();
  const { gender, setGender } = useGender();
  const opts: { k: Gender; ar: string; en: string }[] = [
    { k: 'women', ar: 'نسائي', en: 'Women' },
    { k: 'men', ar: 'رجالي', en: 'Men' },
    { k: '', ar: 'الكل', en: 'All' },
  ];
  return (
    <View style={{ flexDirection: 'row', alignSelf: 'center', borderWidth: 1, borderColor: C.lineStrong }}>
      {opts.map((o) => {
        const on = gender === o.k;
        return (
          <Pressable key={o.k || 'all'} onPress={() => setGender(o.k)} accessibilityState={{ selected: on }}
            style={{ paddingHorizontal: 18, height: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? C.ink : 'transparent' }}>
            <T size={13} color={on ? C.white : C.sub}>{tr(o.ar, o.en)}</T>
          </Pressable>
        );
      })}
    </View>
  );
}
