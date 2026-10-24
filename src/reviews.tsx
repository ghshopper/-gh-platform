import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { api, listOf } from './api';
import { useAuth } from './auth';
import { useFeature } from './features';
import { num } from './format';
import { Icon } from './icons';
import { useLang } from './lang';
import { C, S } from './theme';
import type { Product } from './types';
import { Kicker, SectionTitle, T } from './ui';

/** Five thin stars; tappable when `onChange` is given. */
export function Stars({ value, size = 14, onChange, color = C.ink }: { value: number; size?: number; onChange?: (v: number) => void; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Pressable key={i} disabled={!onChange} onPress={() => onChange?.(i)} hitSlop={4} accessibilityLabel={`${i}`}>
          <Icon name={i <= Math.round(value) ? 'starFill' : 'star'} size={size} color={color} stroke={1.2} />
        </Pressable>
      ))}
    </View>
  );
}

/** Approved product rating: rating_avg / rating_count (older payloads: reviews_*). */
export function productRating(p: Product): { avg: number; count: number } {
  const count = num(p.rating_count, num(p.reviews_count));
  const avg = num(p.rating_avg, num(p.reviews_avg_rating));
  return { avg, count };
}

/** Small "★ 4.8 (12)" line under a product card. */
export function RatingLine({ product }: { product: Product }) {
  const reviews = useFeature('reviews');
  const { avg, count } = productRating(product);
  if (!reviews.on || count <= 0 || avg <= 0) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
      <Icon name="starFill" size={11} color={C.gold} stroke={1} />
      <T latin size={11} color={C.sub}>{avg.toFixed(1)}</T>
      <T latin size={10.5} color={C.faint}>({count})</T>
    </View>
  );
}

interface Pending { ps_order_id?: string | number | null; order_id?: string | number | null; invoice_no?: string | null; delivered_at?: string | null }

const DISMISSED = 'service_review_dismissed';

/** Home: "كيف كانت تجربتك معنا؟" for a delivered order that has no service review yet. */
export function ServiceReviewPrompt() {
  const { tr } = useLang();
  const { loggedIn } = useAuth();
  const reviews = useFeature('reviews');
  const [item, setItem] = useState<Pending | null>(null);
  const enabled = loggedIn && reviews.on && reviews.service !== false;

  const load = useCallback(async () => {
    if (!enabled) {
      setItem(null);
      return;
    }
    try {
      const list = listOf<Pending>(await api.get<unknown>('/customer/service-reviews/pending'));
      const raw = await AsyncStorage.getItem(DISMISSED).catch(() => null);
      const off: string[] = raw ? JSON.parse(raw) : [];
      const key = (p: Pending) => `${p.ps_order_id ?? ''}|${p.order_id ?? ''}`;
      setItem(list.find((p) => !off.includes(key(p))) ?? null);
    } catch {
      setItem(null);
    }
  }, [enabled]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!item) return null;
  const open = (rating?: number) =>
    router.push({
      pathname: '/service-review',
      params: {
        ps_order_id: item.ps_order_id ? String(item.ps_order_id) : '',
        order_id: item.order_id ? String(item.order_id) : '',
        invoice_no: item.invoice_no ?? '',
        rating: rating ? String(rating) : '',
      },
    });
  const dismiss = async () => {
    const raw = await AsyncStorage.getItem(DISMISSED).catch(() => null);
    const off: string[] = raw ? JSON.parse(raw) : [];
    off.push(`${item.ps_order_id ?? ''}|${item.order_id ?? ''}`);
    await AsyncStorage.setItem(DISMISSED, JSON.stringify(off.slice(-50))).catch(() => undefined);
    setItem(null);
  };
  return (
    <View style={{ marginHorizontal: S.gutter, marginTop: 18, padding: 18, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface2, gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Kicker color={C.gold}>YOUR EXPERIENCE</Kicker>
        <Pressable onPress={dismiss} hitSlop={10} accessibilityLabel={tr('لاحقاً', 'Later')}>
          <Icon name="close" size={16} color={C.muted} />
        </Pressable>
      </View>
      <T size={16} w="medium">{tr('كيف كانت تجربتك معنا؟', 'How was your experience with us?')}</T>
      {item.invoice_no ? <T size={12.5} color={C.muted}>{tr(`طلب ${item.invoice_no}`, `Order ${item.invoice_no}`)}</T> : null}
      <View style={{ marginTop: 4 }}>
        <Stars value={0} size={28} color={C.gold} onChange={(v) => open(v)} />
      </View>
    </View>
  );
}

interface ServiceReview { first_name?: string | null; rating: number | string; comment?: string | null; created_at?: string | null }

/** Home block "آراء عملائنا": approved service reviews. */
export function CustomerReviews() {
  const { tr } = useLang();
  const reviews = useFeature('reviews');
  const enabled = reviews.on && reviews.service !== false;
  const [data, setData] = useState<{ avg: number; count: number; data: ServiceReview[] } | null>(null);

  useEffect(() => {
    if (!enabled) {
      setData(null);
      return;
    }
    api.get<{ avg?: number | string; count?: number | string; data?: ServiceReview[] }>('/app/service-reviews')
      .then((r) => setData({ avg: num(r?.avg), count: num(r?.count), data: (r?.data ?? []).filter((x) => (x.comment ?? '').trim()) }))
      .catch(() => setData(null));
  }, [enabled]);

  if (!enabled || !data || !data.count || !data.data.length) return null;
  return (
    <View style={{ marginTop: 40 }}>
      <SectionTitle title={tr('آراء عملائنا', 'What our clients say')} />
      <View style={{ paddingHorizontal: S.gutter, flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: -6, marginBottom: 14 }}>
        <T latin size={26} lh={30}>{data.avg.toFixed(1)}</T>
        <Stars value={data.avg} size={13} color={C.gold} />
        <T size={12} color={C.muted}>{tr(`${data.count} تقييم`, `${data.count} reviews`)}</T>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: S.gutter, gap: 10 }}>
        {data.data.map((r, i) => (
          <View key={i} style={{ width: 250, padding: 18, backgroundColor: C.cream, gap: 10, justifyContent: 'space-between' }}>
            <T serif size={34} color={C.gold} lh={30}>“</T>
            <T size={13.5} color={C.ink} w="light" lines={5}>{r.comment}</T>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <T size={12.5} w="medium">{r.first_name || tr('عميل GH', 'GH client')}</T>
              <Stars value={num(r.rating)} size={11} color={C.gold} />
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
