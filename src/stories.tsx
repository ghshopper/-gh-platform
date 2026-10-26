import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Modal, PanResponder, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, imageUrl } from './api';
import { useFeature } from './features';
import { omr, productPrice, productWasPrice } from './format';
import { Icon } from './icons';
import { useLang } from './lang';
import { C, S } from './theme';
import type { Product } from './types';
import { T } from './ui';

/** One piece from GET /app/weekly. */
interface WeeklyProduct {
  id: number;
  name_ar?: string | null;
  name_en?: string | null;
  brand?: string | null;
  price: number | string;
  compare_price?: number | string | null;
  sale_price?: number | string | null;
  image?: string | null;
  images?: string[] | null;
  badge?: string | null;
  badge_en?: string | null;
}

interface Weekly { title_ar?: string | null; title_en?: string | null; products: WeeklyProduct[] }

const SEEN = 'weekly_seen_v1';
const DURATION = 5000;
const GOLD = '#C9A465';

function photoOf(p: WeeklyProduct): string {
  return imageUrl(p.image || (p.images ?? [])[0] || '');
}

/** Same price rules as the rest of the app (sale / discount / old price). */
function prices(p: WeeklyProduct): { now: number; was: number | null } {
  const asProduct = p as unknown as Product;
  return { now: productPrice(asProduct), was: productWasPrice(asProduct) };
}

/** "جديدنا هذا الأسبوع": round story bubbles on Home; tapping one opens the viewer. */
export function WeeklyStories() {
  const { tr, isAr, pick } = useLang();
  const flag = useFeature('weekly_new');
  const [data, setData] = useState<Weekly | null>(null);
  const [seen, setSeen] = useState<number[]>([]);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(SEEN).then((raw) => raw && setSeen(JSON.parse(raw))).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (!flag.on) {
      setData(null);
      return;
    }
    api.get<Weekly>('/app/weekly')
      .then((r) => setData({ title_ar: r?.title_ar, title_en: r?.title_en, products: Array.isArray(r?.products) ? r.products : [] }))
      .catch(() => undefined);
  }, [flag.on]);

  const markSeen = useCallback((id: number) => {
    setSeen((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id].slice(-300);
      AsyncStorage.setItem(SEEN, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);

  if (!flag.on || !data?.products.length) return null;
  const list = data.products;
  const title = (isAr ? data.title_ar : data.title_en) || data.title_ar || data.title_en || (isAr ? flag.title_ar : flag.title_en) || tr('جديدنا هذا الأسبوع', 'New this week');

  return (
    <View style={{ marginTop: 26 }}>
      <View style={{ paddingHorizontal: S.gutter, marginBottom: 12, flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <T size={15} w="medium">{title}</T>
        <T latin size={10.5} spacing={2.5} color={C.gold}>NEW</T>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: S.gutter, gap: 14 }}>
        {list.map((p, i) => {
          const was = seen.includes(p.id);
          return (
            <Pressable key={p.id} onPress={() => setOpen(i)} accessibilityRole="button" accessibilityLabel={`${p.brand ?? ''} ${pick(p, 'name')}`}
              style={{ width: 72, alignItems: 'center', gap: 6, opacity: was ? 0.5 : 1 }}>
              <View style={{ width: 70, height: 70, borderRadius: 35, borderWidth: was ? 1 : 1.6, borderColor: was ? C.lineStrong : GOLD, padding: 3 }}>
                <View style={{ flex: 1, borderRadius: 32, overflow: 'hidden', backgroundColor: C.surface }}>
                  {photoOf(p) ? <Image source={{ uri: photoOf(p) }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={200} cachePolicy="memory-disk" /> : null}
                </View>
              </View>
              <T latin size={9.5} spacing={1.2} lines={1} center color={C.sub}>{(p.brand ?? '').toUpperCase()}</T>
            </Pressable>
          );
        })}
      </ScrollView>
      {open !== null ? <StoryViewer products={list} start={open} onClose={() => setOpen(null)} onSeen={markSeen} /> : null}
    </View>
  );
}

/**
 * Full-screen stories: one piece each, progress bars on top, 5 s each,
 * tap the reading-forward side for next and the other for previous, hold to
 * pause, swipe down or ✕ to close, "شوف القطعة" opens the product.
 */
function StoryViewer({ products, start, onClose, onSeen }: { products: WeeklyProduct[]; start: number; onClose: () => void; onSeen: (id: number) => void }) {
  const insets = useSafeAreaInsets();
  const { tr, isAr, pick, dir } = useLang();
  const [index, setIndex] = useState(start);
  const progress = useRef(new Animated.Value(0)).current;
  const anim = useRef<Animated.CompositeAnimation | null>(null);
  const paused = useRef(false);
  const drag = useRef(new Animated.Value(0)).current;
  const { width: W } = useWindowDimensions();

  const p = products[index];

  const run = useCallback((from: number) => {
    anim.current?.stop();
    progress.setValue(from);
    anim.current = Animated.timing(progress, { toValue: 1, duration: DURATION * (1 - from), useNativeDriver: false });
    anim.current.start(({ finished }) => {
      if (finished) setIndex((i) => (i + 1 < products.length ? i + 1 : -1));
    });
  }, [products.length, progress]);

  useEffect(() => () => anim.current?.stop(), []);

  useEffect(() => {
    if (index < 0 || index >= products.length) {
      onClose();
      return;
    }
    onSeen(products[index].id);
    run(0);
    // preload the next photo
    const nxt = products[index + 1];
    if (nxt && photoOf(nxt)) Image.prefetch(photoOf(nxt)).catch(() => undefined);
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (d: 1 | -1) => {
    const n = index + d;
    if (n < 0) run(0);
    else if (n >= products.length) onClose();
    else setIndex(n);
  };

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 12 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => drag.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > 110) {
          drag.setValue(0);
          onClose();
        } else Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
      },
    }),
  ).current;

  const pause = () => {
    if (paused.current) return;
    paused.current = true;
    anim.current?.stop();
  };
  const resume = () => {
    if (!paused.current) return;
    paused.current = false;
    progress.stopAnimation((v) => run(v));
  };

  const tap = (pageX: number) => {
    // RTL: the left half moves forward (the way Arabic reads); LTR: the right half.
    const leftHalf = pageX < W / 2;
    go(leftHalf === isAr ? 1 : -1);
  };

  const view = () => {
    if (!p) return;
    onClose();
    router.push({ pathname: '/product/[id]', params: { id: String(p.id) } });
  };

  const pr = p ? prices(p) : { now: 0, was: null };

  return (
    <Modal visible animationType="fade" presentationStyle="overFullScreen" transparent onRequestClose={onClose} statusBarTranslucent>
      <Animated.View {...pan.panHandlers} style={[{ flex: 1, backgroundColor: '#000', transform: [{ translateY: drag }] }, dir]}>
        {p ? (
          <>
            {photoOf(p) ? (
              <Image source={{ uri: photoOf(p) }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" transition={150} cachePolicy="memory-disk" />
            ) : null}
            {/* tap zones: hold to pause */}
            <Pressable
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              onPress={(e) => tap(e.nativeEvent.pageX)}
              onLongPress={pause}
              onPressOut={resume}
              delayLongPress={220}
              accessibilityLabel={tr('القطعة التالية', 'Next piece')}
            />
            {/* top: progress bars + close */}
            <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 8, left: 10, right: 10, gap: 10 }}>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {products.map((_, i) => (
                  <View key={i} style={{ flex: 1, height: 2, backgroundColor: 'rgba(255,255,255,0.35)', overflow: 'hidden' }}>
                    {i < index ? <View style={{ flex: 1, backgroundColor: '#fff' }} /> : i === index ? (
                      <Animated.View style={{ height: 2, backgroundColor: '#fff', width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
                    ) : null}
                  </View>
                ))}
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <T latin size={11} spacing={3} color="#fff">GH · NEW THIS WEEK</T>
                <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={tr('إغلاق', 'Close')}
                  style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="close" size={22} color="#fff" stroke={1.6} />
                </Pressable>
              </View>
            </View>
            {/* bottom: brand, name, price, button */}
            <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
              <View style={{ paddingHorizontal: 22, paddingTop: 60, paddingBottom: Math.max(insets.bottom, 18) + 6, gap: 6, backgroundColor: 'rgba(0,0,0,0.42)' }}>
                {(isAr ? p.badge || p.badge_en : p.badge_en || p.badge) ? (
                  <View style={{ alignSelf: 'flex-start', backgroundColor: '#fff', paddingHorizontal: 9, paddingVertical: 4, marginBottom: 4 }}>
                    <T size={11.5} color="#111111">{isAr ? p.badge || p.badge_en : p.badge_en || p.badge}</T>
                  </View>
                ) : null}
                {p.brand ? <T latin w="medium" size={13} spacing={2.4} color="#fff">{p.brand.toUpperCase()}</T> : null}
                <T size={16} color="#fff" lines={2}>{pick(p, 'name')}</T>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
                  <T latin size={17} color="#fff">{omr(pr.now)}</T>
                  {pr.was ? <T latin size={14} color="rgba(255,255,255,0.6)" style={{ textDecorationLine: 'line-through' }}>{omr(pr.was)}</T> : null}
                </View>
                <Pressable onPress={view} accessibilityRole="button"
                  style={({ pressed }) => ({ marginTop: 12, height: 50, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}>
                  <T size={15} color="#111111" center>{tr('شوف القطعة', 'View the piece')}</T>
                </Pressable>
              </View>
            </View>
          </>
        ) : null}
      </Animated.View>
    </Modal>
  );
}

