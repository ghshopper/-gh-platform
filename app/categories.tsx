import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Pressable, ScrollView, View } from 'react-native';
import { api, listOf } from '@/api';
import { useAppData } from '@/appdata';
import { Icon } from '@/icons';
import { useLang } from '@/lang';
import { ProductCard } from '@/product-card';
import { C } from '@/theme';
import type { Category, Paginated, Product } from '@/types';
import { Empty, Header, T } from '@/ui';
import { BRAND, CategoryArt, CategoryIcon, kindOf } from '@/category-art';

const W = Dimensions.get('window').width;
const RAIL = 92;

/**
 * Categories the way the previous app had them: a rail of categories on the
 * side, and the chosen category's sub-categories and pieces next to it.
 */
export default function Categories() {
  const { tr, pick, isAr } = useLang();
  const { categories } = useAppData();
  const params = useLocalSearchParams<{ id?: string }>();
  const [selected, setSelected] = useState<number | null>(params.id ? Number(params.id) : null);
  const [sub, setSub] = useState<number | null>(null);
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  const current = useMemo(() => categories.find((c) => c.id === selected) ?? categories[0], [categories, selected]);
  const showId = sub ?? current?.id;

  useEffect(() => {
    if (!showId) return;
    let alive = true;
    setLoading(true);
    api
      .get<Paginated<Product>>('/customer/products', { category_id: showId, per_page: 20 })
      .then((r) => alive && setItems(listOf<Product>(r)))
      .catch(() => alive && setItems([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [showId]);

  const openAll = (c: Category) => router.push({ pathname: '/products', params: { category_id: String(c.id), title: pick(c, 'name') } });
  const contentW = W - RAIL;
  const cardW = (contentW - 16 * 2 - 10) / 2;
  const children = current?.children ?? [];
  const showing = children.find((c) => c.id === sub) ?? current;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header title={tr('الأقسام', 'Categories')} />
      {categories.length === 0 ? (
        <Empty title={tr('لا توجد أقسام حالياً', 'No categories yet')} />
      ) : (
        <View style={{ flex: 1, flexDirection: 'row' }}>
          {/* Rail */}
          <ScrollView style={{ width: RAIL, flexGrow: 0, backgroundColor: C.surface2, borderEndWidth: 1, borderColor: C.line }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            {categories.map((c) => {
              const on = c.id === current?.id;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => { setSelected(c.id); setSub(null); }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  style={{ paddingVertical: 14, paddingHorizontal: 6, alignItems: 'center', gap: 8, backgroundColor: on ? C.bg : 'transparent', borderStartWidth: 3, borderStartColor: on ? BRAND.gold : 'transparent' }}
                >
                  <View style={{ width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? BRAND.maroon : C.surface, borderWidth: on ? 1 : 0, borderColor: BRAND.gold }}>
                    <CategoryIcon kind={kindOf(c)} size={30} color={on ? BRAND.gold : C.sub} stroke={1.3} />
                  </View>
                  <T size={11.5} w={on ? 'semibold' : 'regular'} color={on ? C.ink : C.sub} center lines={2} lh={15}>{pick(c, 'name')}</T>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Content */}
          {current ? (
            <FlatList
              style={{ flex: 1 }}
              data={items}
              keyExtractor={(p) => String(p.id)}
              numColumns={2}
              columnWrapperStyle={{ gap: 10, paddingHorizontal: 16 }}
              contentContainerStyle={{ gap: 20, paddingBottom: 40 }}
              ListHeaderComponent={
                <View style={{ gap: 14 }}>
                  {/* Banner of the chosen category */}
                  <Pressable onPress={() => openAll(showing ?? current)} style={{ marginHorizontal: 16, marginTop: 16 }} accessibilityRole="button">
                    <CategoryArt c={showing ?? current} index={Math.max(0, categories.findIndex((x) => x.id === current.id))} width={contentW - 32} height={(contentW - 32) * 0.52} compact />
                  </Pressable>
                  <View style={{ paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <T size={17} w="semibold" style={{ flex: 1 }} lines={1}>{pick(showing ?? current, 'name')}</T>
                    <Pressable onPress={() => openAll(showing ?? current)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <T size={12.5} color={C.gold}>{tr('عرض الكل', 'View all')}</T>
                      <Icon name="forward" size={13} color={C.gold} flip={isAr} />
                    </Pressable>
                  </View>
                  {children.length ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
                      {[{ id: 0 } as Category, ...children].map((ch) => {
                        const on = ch.id === 0 ? sub === null : sub === ch.id;
                        return (
                          <Pressable key={ch.id} onPress={() => setSub(ch.id === 0 ? null : ch.id)}
                            style={{ height: 34, paddingHorizontal: 14, justifyContent: 'center', borderWidth: 1, borderColor: on ? C.ink : C.lineStrong, backgroundColor: on ? C.ink : C.bg }}>
                            <T size={12.5} color={on ? C.white : C.ink}>{ch.id === 0 ? tr('الكل', 'All') : pick(ch, 'name')}</T>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  ) : null}
                  {loading ? <ActivityIndicator color={C.ink} style={{ marginTop: 20 }} /> : null}
                </View>
              }
              renderItem={({ item }) => (loading ? null : <ProductCard product={item} width={cardW} />)}
              ListEmptyComponent={loading ? undefined : <Empty icon="box" title={tr('لا توجد قطع في هذا القسم حالياً', 'No pieces here yet')} />}
              ListFooterComponent={
                !loading && items.length >= 20 ? (
                  <Pressable onPress={() => openAll(showing ?? current)} style={{ marginHorizontal: 16, marginTop: 4, height: 46, borderWidth: 1, borderColor: C.ink, alignItems: 'center', justifyContent: 'center' }}>
                    <T size={14}>{tr('عرض كل القطع', 'See all pieces')}</T>
                  </Pressable>
                ) : undefined
              }
            />
          ) : null}
        </View>
      )}
    </View>
  );
}
