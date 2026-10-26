import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Modal, Pressable, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCart } from './cart';
import { chosenOptions, inStock, isOnOrder, mustChoose, withSingles, num, omr, optionsExtra, productAttributes, productImages, productPrice, productWasPrice } from './format';
import { EngraveInput } from './engrave';
import { originOf } from './eta';
import { Icon } from './icons';
import { useLang } from './lang';
import { rememberProduct } from './product-cache';
import { C, S } from './theme';
import type { Product } from './types';
import { BrandText, Btn, Photo, Price, T } from './ui';
import { useWishlist } from './wishlist';
import { RatingLine } from './reviews';

export function brandOf(p: Product): string {
  return (p.brand_name_en || p.brand_name || '').trim();
}

export function askToSignIn(tr: (a: string, e: string) => string) {
  Alert.alert(tr('سجّل دخولك', 'Sign in'), tr('سجّل دخولك عشان تحفظ القطع في المفضلة', 'Sign in to save pieces to your wishlist'), [
    { text: tr('لاحقاً', 'Later'), style: 'cancel' },
    { text: tr('تسجيل الدخول', 'Sign in'), onPress: () => router.push('/login') },
  ]);
}

export function openProduct(p: Product) {
  rememberProduct(p);
  router.push({ pathname: '/product/[id]', params: { id: String(p.id) } });
}

/* ---------- Quick add (one sheet + one toast for the whole app) ---------- */

type Listener = (p: Product | null) => void;
let sheetListener: Listener | null = null;
let toastListener: ((text: string, bagLink: boolean) => void) | null = null;

export function quickAdd(p: Product) {
  sheetListener?.(p);
}

/** Small dark bar at the bottom; `bagLink` adds "View bag". */
export function showToast(text: string, bagLink = true) {
  toastListener?.(text, bagLink);
}

function selectableOf(p: Product) {
  return productAttributes(p).filter((a) => a.is_selectable !== false && (a.type === 'engraving' || (a.values ?? []).length > 1));
}

/** Put a piece in the bag straight from a list; asks for size/colour first if it has them. */
function useAddToBag() {
  const cart = useCart();
  const { pick, tr } = useLang();
  return (p: Product, picked: Record<string, string>) => {
    const chosen = withSingles(p, picked, pick);
    const brand = brandOf(p);
    cart.add({
      productId: p.id,
      name: pick(p, 'name'),
      nameEn: p.name_en,
      brand,
      price: productPrice(p) + optionsExtra(p, chosen, pick),
      comparePrice: productWasPrice(p) ? (productWasPrice(p) as number) + optionsExtra(p, chosen, pick) : productWasPrice(p),
      image: productImages(p)[0] ?? '',
      origin: originOf(p),
      options: chosenOptions(chosen),
    });
    showToast(tr('تمت الإضافة للسلة', 'Added to your bag'));
  };
}

/** Mounted once at the root: the options sheet and the "added" toast. */
export function QuickAddHost() {
  const insets = useSafeAreaInsets();
  const { tr, pick, dir } = useLang();
  const add = useAddToBag();
  const [product, setProduct] = useState<Product | null>(null);
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [missing, setMissing] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [bagLink, setBagLink] = useState(true);
  const fade = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    sheetListener = (p) => {
      setChosen({});
      setMissing(null);
      setProduct(p);
    };
    toastListener = (text, link) => {
      setToast(text);
      setBagLink(link);
      if (timer.current) clearTimeout(timer.current);
      Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(fade, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setToast(null));
      }, 2600);
    };
    return () => {
      sheetListener = null;
      toastListener = null;
    };
  }, [fade]);

  const attrs = product ? selectableOf(product) : [];
  const confirm = () => {
    if (!product) return;
    const need = attrs.filter(mustChoose).find((a) => !(chosen[pick(a, 'name')] ?? '').trim());
    if (need) {
      setMissing(pick(need, 'name'));
      return;
    }
    add(product, chosen);
    setProduct(null);
  };

  return (
    <>
      <Modal visible={!!product} transparent animationType="slide" onRequestClose={() => setProduct(null)}>
        <View style={[{ flex: 1, justifyContent: 'flex-end' }, dir]}>
          <Pressable style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: C.scrim }} onPress={() => setProduct(null)} accessibilityLabel={tr('إغلاق', 'Close')} />
          {product ? (
            <View style={{ backgroundColor: C.bg, paddingBottom: Math.max(insets.bottom, 16), maxHeight: '80%' }}>
              <View style={{ flexDirection: 'row', gap: 14, padding: S.gutter, borderBottomWidth: 1, borderBottomColor: C.line }}>
                <Photo path={productImages(product)[0]} label={brandOf(product)} style={{ width: 72, height: 90 }} />
                <View style={{ flex: 1, gap: 2, justifyContent: 'center' }}>
                  {brandOf(product) ? <BrandText>{brandOf(product)}</BrandText> : null}
                  <T size={13} color={C.sub} lines={2}>{pick(product, 'name')}</T>
                  <Price value={productPrice(product)} was={productWasPrice(product)} />
                </View>
                <Pressable onPress={() => setProduct(null)} hitSlop={10} accessibilityLabel={tr('إغلاق', 'Close')}>
                  <Icon name="close" size={20} />
                </Pressable>
              </View>
              <ScrollView contentContainerStyle={{ padding: S.gutter, gap: 20 }}>
                {attrs.map((a, i) => {
                  const label = pick(a, 'name') || tr('الخيار', 'Option');
                  if (a.type === 'engraving') {
                    return <EngraveInput key={i} attr={a} label={label} value={chosen[label] ?? ''} onChange={(v) => setChosen({ ...chosen, [label]: v })} />;
                  }
                  return (
                    <View key={i} style={{ gap: 10 }}>
                      <T size={13} color={C.sub}>{label}{chosen[label] ? `: ${chosen[label]}` : ''}</T>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {(a.values ?? []).map((v, k) => {
                          const val = pick(v, 'value');
                          const on = chosen[label] === val;
                          const set = () => { setChosen({ ...chosen, [label]: val }); setMissing(null); };
                          return v.color_code ? (
                            <Pressable key={k} onPress={set} accessibilityLabel={val} accessibilityState={{ selected: on }}
                              style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: on ? C.ink : C.lineStrong, padding: 3 }}>
                              <View style={{ flex: 1, borderRadius: 15, backgroundColor: v.color_code }} />
                            </Pressable>
                          ) : (
                            <Pressable key={k} onPress={set} accessibilityState={{ selected: on }}
                              style={{ minWidth: 52, height: 42, paddingHorizontal: 12, borderWidth: 1, borderColor: on ? C.ink : C.lineStrong, backgroundColor: on ? C.ink : C.bg, alignItems: 'center', justifyContent: 'center' }}>
                              <T size={13} color={on ? C.white : C.ink} center>{val}{num(v.price_add, 0) ? `  ${num(v.price_add, 0) > 0 ? '+' : '−'}${Math.abs(num(v.price_add, 0))}` : ''}</T>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
                {missing ? <T size={12.5} color={C.red}>{tr(`اختر ${missing} أول`, `Choose ${missing} first`)}</T> : null}
                <Btn label={tr('أضف إلى السلة', 'Add to bag')} icon="bagAdd" onPress={confirm} />
                <Pressable onPress={() => { const p = product; setProduct(null); openProduct(p); }} hitSlop={8} style={{ alignSelf: 'center' }}>
                  <T size={13} color={C.sub} style={{ textDecorationLine: 'underline' }}>{tr('تفاصيل القطعة', 'View details')}</T>
                </Pressable>
              </ScrollView>
            </View>
          ) : null}
        </View>
      </Modal>

      {toast ? (
        <Animated.View pointerEvents="box-none" style={[{ position: 'absolute', left: 16, right: 16, bottom: S.tabBar + insets.bottom * 0.4, opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }, dir]}>
          <View style={{ backgroundColor: C.ink, paddingHorizontal: 16, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Icon name={bagLink ? 'check' : 'bell'} size={18} color={C.white} stroke={1.8} />
            <T size={14} color={C.white} style={{ flex: 1 }} lines={3}>{toast}</T>
            {bagLink ? (
              <Pressable onPress={() => router.navigate('/bag')} hitSlop={10} accessibilityRole="button">
                <T size={13} color={C.white} w="medium" style={{ textDecorationLine: 'underline' }}>{tr('عرض السلة', 'View bag')}</T>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      ) : null}
    </>
  );
}

/* ------------------------------- The card ------------------------------- */

/**
 * Listing card: photo with wishlist and a quick "add to bag" button, a
 * sale/sold-out label, then brand, name and price.
 */
/** The shop's label for this product, in the reader's language (Arabic when no English one was written). */
export function productBadge(p: Product, isAr: boolean): string | null {
  const ar = (p.badge ?? '').trim();
  const en = (p.badge_en ?? '').trim();
  return (isAr ? ar || en : en || ar) || null;
}

export function ProductCard({ product, width, style }: { product: Product; width?: number; style?: StyleProp<ViewStyle> }) {
  const { pick, tr, isAr } = useLang();
  const wish = useWishlist();
  const add = useAddToBag();
  const saved = wish.has(product.id);
  const img = productImages(product)[0];
  const brand = brandOf(product);
  const out = !inStock(product);
  const price = productPrice(product);
  const was = productWasPrice(product);
  const off = was && was > price ? Math.round((1 - price / was) * 100) : 0;
  const badge = productBadge(product, isAr);

  const onQuickAdd = () => {
    if (selectableOf(product).length) quickAdd(product);
    else add(product, {});
  };

  return (
    <Pressable
      onPress={() => openProduct(product)}
      accessibilityRole="button"
      accessibilityLabel={`${brand} ${pick(product, 'name')}`}
      style={({ pressed }) => [{ width, opacity: pressed ? 0.85 : 1 }, style]}
    >
      <View style={{ aspectRatio: 4 / 5, backgroundColor: C.surface }}>
        <Photo path={img} label={brand} style={{ flex: 1, backgroundColor: C.surface }} />

        {out ? (
          <View style={{ position: 'absolute', top: 10, left: 10, backgroundColor: C.veil, paddingHorizontal: 8, paddingVertical: 3 }}>
            <T size={10.5} color={C.sub}>{tr('نفدت الكمية', 'Sold out')}</T>
          </View>
        ) : off >= 5 ? (
          <View style={{ position: 'absolute', top: 10, left: 10, backgroundColor: C.ink, paddingHorizontal: 7, paddingVertical: 2 }}>
            <T latin size={10.5} color={C.white} spacing={0.6}>{`-${off}%`}</T>
          </View>
        ) : product.vip_early ? (
          <View style={{ position: 'absolute', top: 10, left: 10, backgroundColor: '#111', paddingHorizontal: 7, paddingVertical: 2 }}>
            <T size={10.5} color="#E8D3A6">{tr('🖤 لك قبل الكل', '🖤 Yours first')}</T>
          </View>
        ) : product.points_boost ? (
          <View style={{ position: 'absolute', top: 10, left: 10, backgroundColor: '#5C0B16', paddingHorizontal: 7, paddingVertical: 2 }}>
            <T size={10.5} color="#F2E3C8">{tr(`⚡ نقاط ×${product.points_boost}`, `⚡ ${product.points_boost}× points`)}</T>
          </View>
        ) : null}

        <Pressable
          onPress={async () => {
            if (!(await wish.toggle(product))) askToSignIn(tr);
          }}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={saved ? tr('إزالة من المفضلة', 'Remove from wishlist') : tr('أضف إلى المفضلة', 'Add to wishlist')}
          style={{ position: 'absolute', top: 2, right: 2, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name={saved ? 'heartFill' : 'heart'} size={18} color={saved ? C.maroon : C.ink} stroke={1.3} />
        </Pressable>

        {!out ? (
          <Pressable
            onPress={onQuickAdd}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={tr('أضف إلى السلة', 'Add to bag')}
            style={({ pressed }) => ({
              position: 'absolute',
              bottom: 8,
              right: 8,
              width: 36,
              height: 36,
              backgroundColor: pressed ? C.ink : C.bg,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: C.black,
              shadowOpacity: 0.08,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 1 },
              elevation: 1,
            })}
          >
            {({ pressed }) => <Icon name="bagAdd" size={19} color={pressed ? C.white : C.ink} stroke={1.35} />}
          </Pressable>
        ) : null}
      </View>

      {badge ? (
        <View style={{ alignSelf: 'flex-start', marginTop: -9, backgroundColor: C.ink, paddingHorizontal: 8, paddingVertical: 3, maxWidth: '100%' }}>
          <T size={10.5} color={C.white} lines={1}>{badge}</T>
        </View>
      ) : null}

      <View style={{ paddingTop: badge ? 7 : 10, gap: 3 }}>
        {brand ? <BrandText size={11}>{brand}</BrandText> : null}
        <T size={12.5} color={C.sub} w="light" lines={2} lh={18}>{pick(product, 'name')}</T>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 7, flexWrap: 'wrap', marginTop: 2 }}>
          <T latin size={13} w="medium" color={off ? C.red : C.ink}>{omr(price)}</T>
          {off ? <T latin size={11.5} color={C.faint} style={{ textDecorationLine: 'line-through' }}>{omr(was ?? 0)}</T> : null}
        </View>
        <RatingLine product={product} />
        {!out ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: isOnOrder(product) ? C.amber : C.green }} />
            <T size={10.5} color={C.muted}>{isOnOrder(product) ? tr('بالطلب', 'On order') : tr('تسليم فوري', 'Ready to deliver')}</T>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
