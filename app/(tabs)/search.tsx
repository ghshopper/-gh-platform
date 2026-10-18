import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Dimensions, Keyboard, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppData } from '@/appdata';
import { ProductBrowser } from '@/browse';
import { Icon } from '@/icons';
import { useLang } from '@/lang';
import { C, F, S } from '@/theme';
import type { Brand, Category } from '@/types';
import { Kicker, Photo, T } from '@/ui';

const W = Dimensions.get('window').width;
const RECENT = 'search_recent_v1';

function brandName(b: Brand) {
  return (b.name_en || b.name_ar || '').trim();
}

/** Big editorial picture with the category name under it. */
function Tile({ c, width, height, onPress }: { c: Category; width: number; height: number; onPress: () => void }) {
  const { pick, tr } = useLang();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ width, opacity: pressed ? 0.85 : 1 })}>
      <Photo path={c.image || c.icon} label={c.name_en ?? ''} style={{ width, height }} />
      <View style={{ paddingTop: 10, paddingBottom: 4, gap: 2 }}>
        <T size={15} w="medium" lines={1}>{pick(c, 'name')}</T>
        <T size={12} color={C.muted} style={{ textDecorationLine: 'underline' }}>{tr('تسوّق الآن', 'Shop now')}</T>
      </View>
    </Pressable>
  );
}

export default function SearchTab() {
  const insets = useSafeAreaInsets();
  const { tr, pick } = useLang();
  const { categories, brands } = useAppData();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(RECENT)
      .then((v) => setRecent(v ? (JSON.parse(v) as string[]).slice(0, 8) : []))
      .catch(() => undefined);
  }, []);

  const remember = (q: string) => {
    const t = q.trim();
    if (t.length < 2) return;
    const next = [t, ...recent.filter((r) => r.toLowerCase() !== t.toLowerCase())].slice(0, 8);
    setRecent(next);
    AsyncStorage.setItem(RECENT, JSON.stringify(next)).catch(() => undefined);
  };

  const q = query.trim();
  const lower = q.toLowerCase();
  const brandHits = useMemo(
    () => (lower ? brands.filter((b) => brandName(b).toLowerCase().includes(lower) || (b.name_ar ?? '').includes(q)).slice(0, 8) : []),
    [brands, lower, q],
  );
  const catHits = useMemo(() => {
    if (!lower) return [];
    const all = categories.flatMap((c) => [c, ...(c.children ?? [])]);
    return all.filter((c) => (c.name_en ?? '').toLowerCase().includes(lower) || (c.name_ar ?? '').includes(q)).slice(0, 8);
  }, [categories, lower, q]);

  const openCategory = (c: Category) => router.push({ pathname: '/products', params: { category_id: String(c.id), title: pick(c, 'name') } });
  const openBrand = (b: Brand) => router.push({ pathname: '/brand/[id]', params: { id: String(b.id) } });

  const half = (W - S.gutter * 2 - 12) / 2;
  const [first, ...rest] = categories;

  const suggestions = brandHits.length || catHits.length ? (
    <View style={{ paddingHorizontal: S.gutter, paddingBottom: 6, gap: 10 }}>
      {brandHits.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {brandHits.map((b) => (
            <Pressable key={`b${b.id}`} onPress={() => { remember(q); openBrand(b); }}
              style={{ height: 36, paddingHorizontal: 14, borderWidth: 1, borderColor: C.ink, justifyContent: 'center' }}>
              <T latin w="medium" size={11.5} spacing={1.4}>{brandName(b).toUpperCase()}</T>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      {catHits.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {catHits.map((c) => (
            <Pressable key={`c${c.id}`} onPress={() => { remember(q); openCategory(c); }}
              style={{ height: 36, paddingHorizontal: 14, borderWidth: 1, borderColor: C.lineStrong, justifyContent: 'center' }}>
              <T size={13}>{pick(c, 'name')}</T>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </View>
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top }}>
      {/* Search field */}
      <View style={{ paddingHorizontal: S.gutter, paddingTop: 12, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, height: 50, borderWidth: 1, borderColor: focused ? C.ink : C.lineStrong, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 }}>
          <Icon name="search" size={19} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onSubmitEditing={() => remember(query)}
            returnKeyType="search"
            autoCorrect={false}
            placeholder={tr('ابحث عن قطعة، براند أو فئة', 'Search pieces, brands or categories')}
            placeholderTextColor={C.faint}
            style={{ flex: 1, height: '100%', fontFamily: F.regular, fontSize: 15, color: C.ink }}
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel={tr('مسح', 'Clear')}>
              <Icon name="close" size={16} color={C.muted} />
            </Pressable>
          ) : null}
        </View>
        {focused || query ? (
          <Pressable onPress={() => { setQuery(''); Keyboard.dismiss(); }} hitSlop={8}>
            <T size={14}>{tr('إلغاء', 'Cancel')}</T>
          </Pressable>
        ) : null}
      </View>

      {q ? (
        <ProductBrowser initial={{ search: q }} search={q} showSearch={false} header={suggestions} />
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
          {recent.length ? (
            <View style={{ paddingHorizontal: S.gutter, paddingTop: 6, paddingBottom: 18, gap: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <T size={13} w="medium">{tr('عمليات البحث الأخيرة', 'Recent searches')}</T>
                <Pressable onPress={() => { setRecent([]); AsyncStorage.removeItem(RECENT).catch(() => undefined); }} hitSlop={8}>
                  <T size={12} color={C.muted}>{tr('مسح', 'Clear')}</T>
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {recent.map((r) => (
                  <Pressable key={r} onPress={() => setQuery(r)} style={{ height: 34, paddingHorizontal: 12, backgroundColor: C.surface, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Icon name="search" size={13} color={C.muted} />
                    <T size={12.5}>{r}</T>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {first ? (
            <View style={{ paddingHorizontal: S.gutter, gap: 18 }}>
              <Kicker>{tr('SHOP BY CATEGORY · تسوّق حسب الفئة', 'SHOP BY CATEGORY')}</Kicker>
              <Tile c={first} width={W - S.gutter * 2} height={(W - S.gutter * 2) * 0.62} onPress={() => openCategory(first)} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, rowGap: 18 }}>
                {rest.map((c) => <Tile key={c.id} c={c} width={half} height={half * 1.25} onPress={() => openCategory(c)} />)}
              </View>
            </View>
          ) : null}

          {brands.length ? (
            <View style={{ marginTop: 34, gap: 14 }}>
              <View style={{ paddingHorizontal: S.gutter, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Kicker>{tr('BRANDS · البراندات', 'BRANDS')}</Kicker>
                <Pressable onPress={() => router.navigate('/brands')} hitSlop={8}>
                  <T size={12.5} color={C.sub} style={{ textDecorationLine: 'underline' }}>{tr('كل البراندات', 'All brands')}</T>
                </Pressable>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: S.gutter, gap: 8 }}>
                {brands.slice(0, 20).map((b) => (
                  <Pressable key={b.id} onPress={() => openBrand(b)} style={{ height: 40, paddingHorizontal: 16, borderWidth: 1, borderColor: C.lineStrong, justifyContent: 'center' }}>
                    <T latin w="medium" size={11.5} spacing={1.6}>{brandName(b).toUpperCase()}</T>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
