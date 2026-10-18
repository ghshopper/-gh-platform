import { ScrollView, View } from 'react-native';
import { api, listOf } from '@/api';
import { useAuth } from '@/auth';
import { num, omr } from '@/format';
import { useLoad } from '@/hooks';
import { useLang } from '@/lang';
import { C, S } from '@/theme';
import type { LoyaltyTier } from '@/types';
import { Header, Kicker, Loader, T } from '@/ui';

export default function Loyalty() {
  const { tr, pick } = useLang();
  const { user } = useAuth();
  const q = useLoad(async () => {
    const [bal, tiers] = await Promise.all([
      api.get<{ balance?: number | string; conversion_rate?: number | string }>('/customer/loyalty/balance'),
      api.get<unknown>('/customer/loyalty/tiers'),
    ]);
    return { balance: num(bal?.balance), rate: num(bal?.conversion_rate, 0.01), tiers: listOf<LoyaltyTier>(tiers) };
  }, []);
  const points = q.data?.balance ?? num(user?.loyalty_points);
  const tiers = (q.data?.tiers ?? []).slice().sort((a, b) => num(a.min_points) - num(b.min_points));
  const current = [...tiers].reverse().find((t) => points >= num(t.min_points));
  const next = tiers.find((t) => num(t.min_points) > points);
  return (
    <View style={{ flex: 1, backgroundColor: C.white }}>
      <Header title={tr('برنامج الولاء', 'Loyalty')} />
      {q.loading ? <Loader /> : (
        <ScrollView contentContainerStyle={{ padding: S.gutter, gap: 18, paddingBottom: 40 }}>
          <View style={{ backgroundColor: C.cream, padding: 24, alignItems: 'center', gap: 6 }}>
            <Kicker color={C.gold} center>GH LOYALTY</Kicker>
            <T latin size={40} center>{String(points)}</T>
            <T size={13} color={C.sub} center>{tr('نقطة', 'points')} · {tr('تساوي', 'worth')} {omr(points * (q.data?.rate ?? 0.01))}</T>
            {current ? <T size={14} w="medium" center>{tr('مستواك: ', 'Tier: ')}{pick(current, 'name')}</T> : null}
            {next ? <T size={12.5} color={C.muted} center>{tr(`باقي ${num(next.min_points) - points} نقطة للوصول إلى ${pick(next, 'name')}`, `${num(next.min_points) - points} points to ${pick(next, 'name')}`)}</T> : null}
          </View>
          <T size={13.5} color={C.sub}>{tr('تجمع نقاط مع كل طلب، وتقدر تستخدمها كخصم وقت الدفع.', 'You earn points with every order and can use them as a discount at checkout.')}</T>
          {tiers.map((t) => (
            <View key={t.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.line }}>
              <T size={15} w={current?.id === t.id ? 'medium' : 'regular'}>{pick(t, 'name')}</T>
              <T latin size={13} color={C.sub}>{`${num(t.min_points)}+`}</T>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
