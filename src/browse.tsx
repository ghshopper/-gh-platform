import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useGender } from './gender';
import { ActivityIndicator, Dimensions, FlatList, Modal, Pressable, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, listOf } from './api';
import { useAppData } from './appdata';
import { Icon } from './icons';
import { useLang } from './lang';
import { ProductCard } from './product-card';
import { C, F, S, gridCardW, gridCols } from './theme';
import type { Paginated, Product } from './types';
import { Btn, Empty, ErrorBox, Loader, T } from './ui';

const W = Dimensions.get('window').width;

export interface BrowseFilters {
  search?: string;
  category_id?: string;
  brand_id?: string;
  attributes?: string[];
  min_price?: string;
  max_price?: string;
  sort?: 'new' | 'old' | 'price_asc' | 'price_desc';
  /** '1' = only pieces ready to deliver now (in stock with us). */
  instant?: string;
}

interface AttributeRow {
  id: number;
  name_ar?: string;
  name_en?: string;
  values?: { id: number; value_ar?: string; value_en?: string; color_code?: string | null }[];
}

const SORTS: { key: NonNullable<BrowseFilters['sort']>; ar: string; en: string; field: string; dir: string }[] = [
  { key: 'new', ar: 'الأحدث', en: 'Newest', field: 'created_at', dir: 'desc' },
  { key: 'old', ar: 'الأقدم', en: 'Oldest', field: 'created_at', dir: 'asc' },
  { key: 'price_asc', ar: 'السعر: من الأقل', en: 'Price: low to high', field: 'price', dir: 'asc' },
  { key: 'price_desc', ar: 'السعر: من الأعلى', en: 'Price: high to low', field: 'price', dir: 'desc' },
];

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }}
      style={{ paddingHorizontal: 14, height: 38, justifyContent: 'center', borderWidth: 1, borderColor: on ? C.ink : C.lineStrong, backgroundColor: on ? C.ink : C.white }}>
      <T size={13} color={on ? C.white : C.ink}>{label}</T>
    </Pressable>
  );
}

function FilterSheet({ visible, value, onClose, onApply }: { visible: boolean; value: BrowseFilters; onClose: () => void; onApply: (f: BrowseFilters) => void }) {
  const insets = useSafeAreaInsets();
  const { tr, pick, dir } = useLang();
  const app = useAppData();
  const [draft, setDraft] = useState<BrowseFilters>(value);
  const [attrs, setAttrs] = useState<AttributeRow[]>([]);

  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  useEffect(() => {
    api.get<unknown>('/customer/attributes').then((r) => setAttrs(listOf<AttributeRow>(r))).catch(() => undefined);
  }, []);

  const toggleAttr = (id: number) => {
    const s = new Set(draft.attributes ?? []);
    const k = String(id);
    if (s.has(k)) s.delete(k);
    else s.add(k);
    setDraft({ ...draft, attributes: [...s] });
  };

  const priceInput = (key: 'min_price' | 'max_price', label: string) => (
    <View style={{ flex: 1, gap: 4 }}>
      <T size={12} color={C.sub}>{label}</T>
      <TextInput
        keyboardType="decimal-pad"
        value={draft[key] ?? ''}
        onChangeText={(t) => setDraft({ ...draft, [key]: t.replace(/[^0-9.]/g, '') })}
        placeholder="OMR"
        placeholderTextColor={C.faint}
        style={{ fontFamily: F.latin, fontSize: 15, borderBottomWidth: 1, borderBottomColor: C.lineStrong, paddingVertical: 8, color: C.ink }}
      />
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[{ flex: 1, backgroundColor: C.bg }, dir]}>
        <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: C.line }}>
          <Pressable onPress={onClose} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={tr('إغلاق', 'Close')}>
            <Icon name="close" size={20} />
          </Pressable>
          <T size={16} w="medium" center style={{ flex: 1 }}>{tr('تصفية المنتجات', 'Filter')}</T>
          <Pressable onPress={() => setDraft({ search: value.search })} style={{ paddingHorizontal: 10 }} hitSlop={8}>
            <T size={13} color={C.sub}>{tr('مسح الكل', 'Clear')}</T>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: S.gutter, gap: 26, paddingBottom: 120 }}>
          <View style={{ gap: 12 }}>
            <T size={13} w="medium">{tr('ترتيب حسب', 'Sort by')}</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {SORTS.map((s) => <Chip key={s.key} label={tr(s.ar, s.en)} on={(draft.sort ?? 'new') === s.key} onPress={() => setDraft({ ...draft, sort: s.key })} />)}
            </View>
          </View>
          {app.categories.length ? (
            <View style={{ gap: 12 }}>
              <T size={13} w="medium">{tr('الفئات', 'Categories')}</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {app.categories.flatMap((c) => [c, ...(c.children ?? [])]).map((c) => (
                  <Chip key={c.id} label={pick(c, 'name')} on={draft.category_id === String(c.id)}
                    onPress={() => setDraft({ ...draft, category_id: draft.category_id === String(c.id) ? undefined : String(c.id) })} />
                ))}
              </View>
            </View>
          ) : null}
          {app.brands.length ? (
            <View style={{ gap: 12 }}>
              <T size={13} w="medium">{tr('الماركات', 'Brands')}</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {app.brands.map((b) => (
                  <Chip key={b.id} label={(b.name_en ?? b.name_ar ?? '').toUpperCase()} on={draft.brand_id === String(b.id)}
                    onPress={() => setDraft({ ...draft, brand_id: draft.brand_id === String(b.id) ? undefined : String(b.id) })} />
                ))}
              </View>
            </View>
          ) : null}
          {attrs.filter((a) => (a.values ?? []).length).map((a) => (
            <View key={a.id} style={{ gap: 12 }}>
              <T size={13} w="medium">{pick(a, 'name')}</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {(a.values ?? []).map((v) => (
                  <Chip key={v.id} label={pick(v, 'value')} on={(draft.attributes ?? []).includes(String(v.id))} onPress={() => toggleAttr(v.id)} />
                ))}
              </View>
            </View>
          ))}
          <View style={{ gap: 12 }}>
            <T size={13} w="medium">{tr('نطاق السعر', 'Price range')}</T>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              {priceInput('min_price', tr('من', 'From'))}
              {priceInput('max_price', tr('إلى', 'To'))}
            </View>
          </View>
        </ScrollView>
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: Math.max(insets.bottom, 16), borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.white }}>
          <Btn label={tr('تطبيق', 'Apply')} onPress={() => onApply(draft)} />
        </View>
      </View>
    </Modal>
  );
}

/** Product grid with search, filters, sorting and endless scroll. */
export function ProductBrowser({ initial, header, showSearch = true, autoFocus, search }: {
  initial: BrowseFilters; header?: ReactNode; showSearch?: boolean; autoFocus?: boolean;
  /** Search text owned by the parent (the Search tab's own field). */
  search?: string;
}) {
  const { tr, dir } = useLang();
  const [filters, setFilters] = useState<BrowseFilters>(initial);
  const [query, setQuery] = useState(initial.search ?? '');
  const [items, setItems] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [last, setLast] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const reqId = useRef(0);

  const load = useCallback(async (f: BrowseFilters, p: number) => {
    const id = ++reqId.current;
    if (p === 1) setLoading(true);
    else setMore(true);
    setError(null);
    const sort = SORTS.find((s) => s.key === (f.sort ?? 'new')) ?? SORTS[0];
    try {
      const r = await api.get<Paginated<Product>>('/customer/products', {
        page: p,
        per_page: 20,
        search: f.search,
        category_id: f.category_id,
        brand_id: f.brand_id,
        instant: f.instant,
        attributes: f.attributes?.length ? f.attributes.join(',') : undefined,
        min_price: f.min_price,
        max_price: f.max_price,
        sort_field: sort.field,
        sort_direction: sort.dir,
      });
      if (id !== reqId.current) return;
      const rows = listOf<Product>(r);
      setItems((prev) => (p === 1 ? rows : [...prev, ...rows.filter((x) => !prev.some((y) => y.id === x.id))]));
      setPage(r?.current_page ?? p);
      setLast(r?.last_page ?? p);
      setTotal(r?.total ?? rows.length);
    } catch (e) {
      if (id === reqId.current) setError(e instanceof Error ? e.message : 'error');
    } finally {
      if (id === reqId.current) {
        setLoading(false);
        setMore(false);
      }
    }
  }, []);

  const { gender } = useGender();
  useEffect(() => {
    load(filters, 1);
  }, [filters, load, gender]);

  useEffect(() => {
    if (search === undefined) return;
    const t = setTimeout(() => setFilters((f) => (f.search === (search || undefined) ? f : { ...f, search: search || undefined })), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Search as you type (short pause).
  useEffect(() => {
    if (search !== undefined) return;
    if ((filters.search ?? '') === query) return;
    const t = setTimeout(() => setFilters((f) => ({ ...f, search: query || undefined })), 400);
    return () => clearTimeout(t);
  }, [query, filters.search, search]);

  const activeCount =
    (filters.category_id && filters.category_id !== initial.category_id ? 1 : 0) +
    (filters.brand_id && filters.brand_id !== initial.brand_id ? 1 : 0) +
    (filters.attributes?.length ?? 0) +
    (filters.min_price ? 1 : 0) +
    (filters.max_price ? 1 : 0) +
    (filters.sort && filters.sort !== 'new' ? 1 : 0);

  const cardW = gridCardW(W, S.gutter);

  return (
    <View style={{ flex: 1 }}>
      {showSearch ? (
        <View style={{ paddingHorizontal: S.gutter, paddingTop: 10 }}>
          <View style={{ height: 48, borderWidth: 1, borderColor: C.lineStrong, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 }}>
            <Icon name="search" size={18} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              autoFocus={autoFocus}
              returnKeyType="search"
              placeholder={tr('ابحث عن منتج، ماركة، أو فئة', 'Search products, brands or categories')}
              placeholderTextColor={C.faint}
              style={{ flex: 1, fontFamily: F.regular, fontSize: 14, color: C.ink }}
            />
            {query ? (
              <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel={tr('مسح', 'Clear')}>
                <Icon name="close" size={16} color={C.muted} />
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', borderTopWidth: showSearch ? 0 : 1, borderBottomWidth: 1, borderColor: C.line, marginTop: showSearch ? 12 : 0 }}>
        <Pressable onPress={() => setSheet(true)} style={{ flex: 1, height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderEndWidth: 1, borderColor: C.line }} accessibilityRole="button">
          <Icon name="filter" size={18} />
          <T size={14}>{tr('تصفية', 'Filter')}{activeCount ? ` (${activeCount})` : ''}</T>
        </Pressable>
        <View style={{ flex: 1, height: 48, alignItems: 'center', justifyContent: 'center' }}>
          <T size={13} color={C.muted}>{loading ? ' ' : tr(`${total} قطعة`, `${total} pieces`)}</T>
        </View>
      </View>
      {loading && !items.length ? (
        <Loader />
      ) : error && !items.length ? (
        <ErrorBox message={error} onRetry={() => load(filters, 1)} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(p) => String(p.id)}
          numColumns={gridCols(W)}
          ListHeaderComponent={header ? <>{header}</> : undefined}
          columnWrapperStyle={{ gap: 12, paddingHorizontal: S.gutter }}
          contentContainerStyle={{ gap: 24, paddingTop: 18, paddingBottom: 40 }}
          renderItem={({ item }) => <ProductCard product={item} width={cardW} />}
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (!more && !loading && page < last) load(filters, page + 1);
          }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={() => load(filters, 1)} />}
          ListFooterComponent={more ? <ActivityIndicator style={{ margin: 20 }} color={C.ink} /> : undefined}
          ListEmptyComponent={<Empty icon="search" title={tr('لا توجد منتجات مطابقة', 'No matching products')} text={tr('جرب تغيير البحث أو الفلاتر', 'Try a different search or filter')} />}
        />
      )}
      <FilterSheet visible={sheet} value={filters} onClose={() => setSheet(false)} onApply={(f) => { setSheet(false); setFilters({ ...f, search: (search ?? query) || undefined }); }} />
    </View>
  );
}
