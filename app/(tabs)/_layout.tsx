import { Tabs } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCart } from '@/cart';
import { Icon, type IconName } from '@/icons';
import { useLang } from '@/lang';
import { C, F } from '@/theme';
import { T } from '@/ui';

const TABS: { name: string; icon: IconName; ar: string; en: string }[] = [
  { name: 'index', icon: 'home', ar: 'الرئيسية', en: 'Home' },
  { name: 'search', icon: 'search', ar: 'البحث', en: 'Search' },
  { name: 'brands', icon: 'brands', ar: 'البراندات', en: 'Brands' },
  { name: 'bag', icon: 'bag', ar: 'السلة', en: 'Bag' },
  { name: 'account', icon: 'user', ar: 'حسابي', en: 'Account' },
];

// The tab bar props changed shape across expo-router versions, so only the
// parts used here are typed.
interface TabBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation?: { emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean }; navigate: (name: string) => void };
  navigateToTab?: (routeKey: string) => void;
}

function TabBar({ state, navigation, navigateToTab }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { tr } = useLang();
  const { count } = useCart();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.98)', borderTopWidth: 1, borderTopColor: C.line, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 10) }}>
      {state.routes.map((route, i) => {
        const tab = TABS.find((t) => t.name === route.name);
        if (!tab) return null;
        const on = state.index === i;
        const color = on ? C.ink : C.faint;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={tr(tab.ar, tab.en)}
            onPress={() => {
              if (on) return;
              if (navigateToTab) {
                navigateToTab(route.key);
                return;
              }
              const e = navigation?.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!e?.defaultPrevented) navigation?.navigate(route.name);
            }}
            style={{ flex: 1, alignItems: 'center', gap: 4 }}
          >
            <View>
              <Icon name={tab.icon} size={22} color={color} stroke={on ? 1.6 : 1.4} />
              {tab.name === 'bag' && count > 0 ? (
                <View style={{ position: 'absolute', top: -4, right: -9, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
                  <Text style={{ color: C.white, fontFamily: F.latin, fontSize: 9.5 }}>{count}</Text>
                </View>
              ) : null}
            </View>
            <T size={10.5} color={color} center lh={14}>{tr(tab.ar, tab.en)}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(p: unknown) => <TabBar {...(p as TabBarProps)} />} screenOptions={{ headerShown: false }}>
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} />
      ))}
    </Tabs>
  );
}
