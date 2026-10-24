import { router } from 'expo-router';
import { useState } from 'react';
import { Switch, View } from 'react-native';
import { api } from '@/api';
import { useAuth } from '@/auth';
import { useFeature } from '@/features';
import { useLoad } from '@/hooks';
import { Icon, type IconName } from '@/icons';
import { useLang } from '@/lang';
import { C, S } from '@/theme';
import { Empty, ErrorBox, Header, Loader, T } from '@/ui';

type Prefs = { price_drop: boolean; back_in_stock: boolean; brand_new: boolean };
const KEYS: { key: keyof Prefs; icon: IconName; ar: string; en: string; subAr: string; subEn: string }[] = [
  { key: 'price_drop', icon: 'tag', ar: 'نزول السعر', en: 'Price drops', subAr: 'لما ينزل سعر قطعة في مفضلتك', subEn: 'When a piece in your wishlist gets cheaper' },
  { key: 'back_in_stock', icon: 'box', ar: 'رجعت متوفرة', en: 'Back in stock', subAr: 'لما ترجع قطعة نفدت من مفضلتك', subEn: 'When a sold-out piece you saved is back' },
  { key: 'brand_new', icon: 'heart', ar: 'جديد براندك المفضل', en: 'New from your brands', subAr: 'قطع جديدة من البراندات اللي تحبها', subEn: 'New pieces from brands you love' },
];

/** تنبيهات المفضلة: which wishlist alerts this customer wants (features §1). */
export default function AlertPrefs() {
  const { tr } = useLang();
  const { loggedIn } = useAuth();
  const flag = useFeature('wishlist_alerts');
  const q = useLoad(async () => {
    const r = await api.get<Partial<Prefs> & { data?: Partial<Prefs> }>('/customer/alert-prefs');
    const o = r?.data ?? r ?? {};
    return { price_drop: o.price_drop !== false, back_in_stock: o.back_in_stock !== false, brand_new: o.brand_new !== false } as Prefs;
  }, [loggedIn]);
  const [saving, setSaving] = useState(false);

  const set = async (k: keyof Prefs, v: boolean) => {
    if (!q.data) return;
    const prev = q.data;
    const next = { ...prev, [k]: v };
    q.setData(next);
    setSaving(true);
    try {
      await api.put('/customer/alert-prefs', next);
    } catch {
      q.setData(prev);
    } finally {
      setSaving(false);
    }
  };

  const title = tr('تنبيهات المفضلة', 'Wishlist alerts');
  if (!flag.on || !loggedIn) {
    return (
      <View style={{ flex: 1, backgroundColor: C.white }}>
        <Header title={title} />
        <Empty icon="bell" title={!loggedIn ? tr('سجّل دخولك', 'Sign in') : tr('التنبيهات غير متاحة حالياً', 'Alerts are not available right now')}
          action={!loggedIn ? tr('تسجيل الدخول', 'Sign in') : undefined} onAction={() => router.push('/login')} />
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: C.white }}>
      <Header title={title} />
      {q.loading && !q.data ? <Loader /> : q.error && !q.data ? <ErrorBox message={q.error} onRetry={q.reload} /> : (
        <View style={{ paddingHorizontal: S.gutter, paddingTop: 14 }}>
          <T size={13} color={C.sub} style={{ marginBottom: 8 }}>{tr('نرسل لك إشعار عن القطع اللي في مفضلتك. اختر اللي يهمك:', 'We notify you about the pieces in your wishlist. Choose what matters to you:')}</T>
          {KEYS.map((k) => (
            <View key={k.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line }}>
              <Icon name={k.icon} size={21} stroke={1.3} />
              <View style={{ flex: 1 }}>
                <T size={15}>{tr(k.ar, k.en)}</T>
                <T size={12} color={C.muted}>{tr(k.subAr, k.subEn)}</T>
              </View>
              <Switch value={!!q.data?.[k.key]} disabled={saving} onValueChange={(v) => set(k.key, v)}
                trackColor={{ true: C.ink, false: C.lineStrong }} thumbColor={C.white} ios_backgroundColor={C.lineStrong} />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
