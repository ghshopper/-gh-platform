import { Dimensions, ScrollView, View } from 'react-native';
import { api, listOf } from '@/api';
import { useAuth } from '@/auth';
import { dateText, num, omrReal } from '@/format';
import { useLoad } from '@/hooks';
import { Icon } from '@/icons';
import { useLang } from '@/lang';
import { C, S } from '@/theme';
import type { LoyaltyTier } from '@/types';
import { tierLook } from '@/tier-look';
import { Header, Loader, T } from '@/ui';

const W = Dimensions.get('window').width;

interface Balance {
  balance?: number | string;
  conversion_rate?: number | string;
  tier_points?: number | string;
  tier_id?: number | null;
  next_tier_id?: number | null;
  to_next?: number | string;
  points_per_omr?: number | string;
}

interface PointsRow {
  id: number;
  type: 'earn' | 'redeem' | 'adjust' | 'expire' | 'bonus';
  points: number;
  description_ar?: string | null;
  description_en?: string | null;
  order_total?: number | null;
  created_at?: string | null;
}

/** Card looks per tier, from entry level to the top (brand colours only). */
const LOOKS = [
  { bg: '#EFE6D8', ink: '#2A1A12', soft: '#8A6A2E', line: '#C9A465' },
  { bg: '#350304', ink: '#FFFFFF', soft: '#D6B08C', line: '#C9A465' },
  { bg: '#141414', ink: '#FFFFFF', soft: '#C9A465', line: '#C9A465' },
  { bg: '#0B0B0B', ink: '#E8D3A6', soft: '#C9A465', line: '#E8D3A6' },
];
const lookOf = (i: number) => LOOKS[Math.min(i, LOOKS.length - 1)];

const TYPE: Record<string, [string, string]> = {
  earn: ['اكتسبت', 'Earned'],
  redeem: ['استخدمت', 'Used'],
  adjust: ['تعديل', 'Adjusted'],
  expire: ['انتهت', 'Expired'],
  bonus: ['مكافأة', 'Bonus'],
};

function lines(text?: string | null): string[] {
  return (text ?? '').split(/\n|·|•/).map((x) => x.trim()).filter(Boolean);
}

function TierCard({ tier, index, width, current, reached, points, worth }: {
  tier: LoyaltyTier; index: number; width: number; current: boolean; reached: boolean; points?: number; worth?: string;
}) {
  const { tr, pick, isAr } = useLang();
  const name = (isAr ? tier.name_ar : tier.name_en) || tier.name || pick(tier, 'name');
  // same colours as the member card when the tier name is known
  const named = tierLook(`${tier.name_en ?? ''} ${tier.name_ar ?? ''} ${tier.name ?? ''}`);
  const look = /beige|burgundy|bordeaux|black|بيج|عناب|أسود|اسود/i.test(`${tier.name_en ?? ''} ${tier.name_ar ?? ''} ${tier.name ?? ''}`)
    ? { bg: named.bg[1], ink: named.ink, soft: named.soft, line: named.line }
    : lookOf(index);
  const mult = num(tier.reward_multiplier, 1);
  return (
    <View style={{ width, aspectRatio: 1.58, backgroundColor: look.bg, padding: 20, justifyContent: 'space-between', overflow: 'hidden', opacity: reached || current ? 1 : 0.92 }}>
      <View style={{ position: 'absolute', top: 8, left: 8, right: 8, bottom: 8, borderWidth: 0.7, borderColor: look.line, opacity: 0.5 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <T latin size={10.5} spacing={3} color={look.soft}>GH LOYALTY</T>
        {current ? (
          <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: look.soft }}>
            <T size={11} color={look.soft}>{tr('مستواك الحالي', 'Your tier')}</T>
          </View>
        ) : reached ? (
          <Icon name="check" size={18} color={look.soft} stroke={1.8} />
        ) : (
          <Icon name="lock" size={16} color={look.soft} stroke={1.4} />
        )}
      </View>
      <View>
        <T serif size={30} color={look.ink} lh={36}>{name}</T>
        <T size={12} color={look.soft}>
          {tr(`من ${num(tier.min_points).toLocaleString('en-US')} نقطة`, `From ${num(tier.min_points).toLocaleString('en-US')} points`)}
          {mult > 1 ? ` · ${tr(`نقاط ×${mult}`, `${mult}× points`)}` : ''}
        </T>
      </View>
      {points !== undefined ? (
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <T latin size={26} color={look.ink} lh={30}>{points.toLocaleString('en-US')}</T>
            <T size={12} color={look.soft}>{tr('نقطة', 'points')}</T>
          </View>
          {worth ? <T latin size={12} color={look.soft}>{worth}</T> : null}
        </View>
      ) : <View />}
    </View>
  );
}

function History({ rows }: { rows: PointsRow[] }) {
  const { tr, isAr, pick } = useLang();
  if (!rows.length) {
    return <T size={13} color={C.muted}>{tr('ما فيه حركات نقاط للحين. بتظهر هنا مع أول طلب يوصلك.', 'No points activity yet. It shows here after your first delivered order.')}</T>;
  }
  const months: { key: string; label: string; rows: PointsRow[] }[] = [];
  for (const r of rows) {
    const d = r.created_at ? new Date(r.created_at) : null;
    const key = d ? `${d.getFullYear()}-${d.getMonth()}` : 'x';
    let g = months.find((m) => m.key === key);
    if (!g) {
      g = { key, label: d ? d.toLocaleDateString(isAr ? 'ar-OM-u-nu-latn' : 'en-GB', { month: 'long', year: 'numeric' }) : '', rows: [] };
      months.push(g);
    }
    g.rows.push(r);
  }
  return (
    <View style={{ gap: 22 }}>
      {months.map((m) => (
        <View key={m.key} style={{ gap: 10 }}>
          <T size={16} w="semibold">{m.label}</T>
          {m.rows.map((r) => {
            const plus = r.points > 0;
            const label = TYPE[r.type] ?? [r.type, r.type];
            return (
              <View key={r.id} style={{ borderWidth: 1, borderColor: C.line }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: C.line }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: plus ? C.greenSoft : C.surface }}>
                    <Icon name={plus ? 'plus' : 'minus'} size={16} color={plus ? C.green : C.red} stroke={1.8} />
                  </View>
                  <T size={13.5} w="medium" style={{ flex: 1 }} lines={2}>{pick(r, 'description') || tr(label[0], label[1])}</T>
                  <T latin size={15} w="medium" color={plus ? C.green : C.red}>{`${plus ? '+' : ''}${r.points.toLocaleString('en-US')}`}</T>
                </View>
                <View style={{ paddingHorizontal: 14, paddingVertical: 10, gap: 6 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><T size={12.5} color={C.muted}>{tr('التاريخ', 'Date')}</T><T size={12.5}>{dateText(r.created_at, isAr)}</T></View>
                  {r.order_total != null ? <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><T size={12.5} color={C.muted}>{tr('قيمة الشراء', 'Purchase')}</T><T latin size={12.5}>{omrReal(r.order_total)}</T></View> : null}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><T size={12.5} color={C.muted}>{tr('الحالة', 'Status')}</T><T size={12.5}>{tr(label[0], label[1])}</T></View>
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export default function Loyalty() {
  const { tr, isAr } = useLang();
  const { user } = useAuth();
  const q = useLoad(async () => {
    const [bal, tiers, hist] = await Promise.all([
      api.get<Balance>('/customer/loyalty/balance'),
      api.get<unknown>('/customer/loyalty/tiers'),
      api.get<unknown>('/customer/loyalty/transactions').catch(() => []),
    ]);
    return { bal, tiers: listOf<LoyaltyTier>(tiers).sort((a, b) => num(a.min_points) - num(b.min_points)), history: listOf<PointsRow>(hist) };
  }, []);

  const bal = q.data?.bal;
  const points = num(bal?.balance, num(user?.loyalty_points));
  const tierPoints = num(bal?.tier_points, points);
  const rate = num(bal?.conversion_rate, 0.01);
  const perOmr = num(bal?.points_per_omr, 1);
  const tiers = q.data?.tiers ?? [];
  const currentIdx = Math.max(0, tiers.findIndex((t) => t.id === bal?.tier_id));
  const current = tiers[currentIdx];
  const next = tiers.find((t) => t.id === bal?.next_tier_id) ?? tiers.find((t) => num(t.min_points) > tierPoints);
  const from = current ? num(current.min_points) : 0;
  const to = next ? num(next.min_points) : from;
  const progress = next && to > from ? Math.min(1, Math.max(0, (tierPoints - from) / (to - from))) : 1;
  const nameOf = (t?: LoyaltyTier) => (t ? (isAr ? t.name_ar : t.name_en) || t.name || '' : '');
  const cardW = W - S.gutter * 2;
  const smallW = Math.min(280, W * 0.72);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header title={tr('برنامج الولاء', 'Loyalty')} />
      {q.loading && !q.data ? <Loader /> : (
        <ScrollView contentContainerStyle={{ paddingBottom: 50 }}>
          <View style={{ padding: S.gutter, gap: 18 }}>
            {current ? (
              <TierCard tier={current} index={currentIdx} width={cardW} current reached points={points} worth={tr(`= ${omrReal(points * rate)}`, `= ${omrReal(points * rate)}`)} />
            ) : null}

            {next ? (
              <View style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <T size={14} w="medium">{tr(`باقي ${Math.max(0, to - tierPoints).toLocaleString('en-US')} نقطة لمستوى ${nameOf(next)}`, `${Math.max(0, to - tierPoints).toLocaleString('en-US')} points to ${nameOf(next)}`)}</T>
                </View>
                <View style={{ height: 4, backgroundColor: C.line }}>
                  <View style={{ width: `${progress * 100}%`, height: 4, backgroundColor: C.gold }} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <T size={11.5} color={C.muted}>{nameOf(current)} · {from.toLocaleString('en-US')}</T>
                  <T size={11.5} color={C.muted}>{nameOf(next)} · {to.toLocaleString('en-US')}</T>
                </View>
              </View>
            ) : tiers.length ? (
              <T size={14} w="medium" color={C.gold}>{tr('وصلت أعلى مستوى 🤍', 'You are at the top tier 🤍')}</T>
            ) : null}

            <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: C.line }}>
              <View style={{ flex: 1, padding: 14, gap: 2, borderEndWidth: 1, borderColor: C.line }}>
                <T size={11.5} color={C.muted}>{tr('تكسب', 'You earn')}</T>
                <T size={13.5} w="medium">{tr(`${perOmr} نقطة لكل ١ ر.ع.`, `${perOmr} pts per OMR 1`)}</T>
              </View>
              <View style={{ flex: 1, padding: 14, gap: 2 }}>
                <T size={11.5} color={C.muted}>{tr('كل نقطة تساوي', 'Each point is worth')}</T>
                <T latin size={13.5} w="medium">{omrReal(rate)}</T>
              </View>
            </View>
            <T size={12.5} color={C.sub}>{tr('النقاط تنضاف لحسابك لما يتسلّم الطلب، وتقدر تستخدمها كخصم في صفحة الدفع. المستوى يحسب على النقاط اللي جمعتها، فاستخدامها ما ينزّل مستواك.', 'Points are added once your order is delivered and can be used as a discount at checkout. Your tier counts the points you have earned, so spending them does not lower it.')}</T>
          </View>

          {tiers.length ? (
            <View style={{ gap: 12, marginTop: 6 }}>
              <T size={18} w="medium" style={{ paddingHorizontal: S.gutter }}>{tr('المستويات', 'Tiers')}</T>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: S.gutter, gap: 12 }} snapToInterval={smallW + 12} decelerationRate="fast">
                {tiers.map((t, i) => {
                  const benefits = lines(isAr ? t.benefits_ar : t.benefits_en);
                  const reached = tierPoints >= num(t.min_points);
                  return (
                    <View key={t.id} style={{ width: smallW, gap: 10 }}>
                      <TierCard tier={t} index={i} width={smallW} current={t.id === current?.id} reached={reached} />
                      {benefits.length ? (
                        <View style={{ gap: 6 }}>
                          {benefits.map((b, k) => (
                            <View key={k} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                              <View style={{ width: 5, height: 5, backgroundColor: C.gold, marginTop: 9, transform: [{ rotate: '45deg' }] }} />
                              <T size={13} color={C.sub} style={{ flex: 1 }}>{b}</T>
                            </View>
                          ))}
                        </View>
                      ) : num(t.reward_multiplier, 1) > 1 ? (
                        <T size={13} color={C.sub}>{tr(`تكسب نقاط ×${num(t.reward_multiplier)} مع كل طلب`, `${num(t.reward_multiplier)}× points on every order`)}</T>
                      ) : null}
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          <View style={{ padding: S.gutter, paddingTop: 28, gap: 14 }}>
            <T size={18} w="medium">{tr('حركة النقاط', 'Points activity')}</T>
            <History rows={q.data?.history ?? []} />
          </View>
        </ScrollView>
      )}
    </View>
  );
}
