import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { api } from './api';
import { useAuth } from './auth';
import { useFeature } from './features';
import { num } from './format';
import { Icon } from './icons';
import { useLang } from './lang';
import { S } from './theme';
import { tierLook } from './tier-look';
import { T } from './ui';

interface Tier {
  id?: number;
  name?: string | null;
  name_ar?: string | null;
  name_en?: string | null;
  color?: string | null;
  benefits_ar?: string | null;
  benefits_en?: string | null;
  min_points?: number | string | null;
}

interface Balance {
  tier_points?: number | string;
  to_next?: number | string;
  tier?: Tier | null;
  next_tier?: Tier | null;
  progress?: number | string;
}

function lines(text?: string | null): string[] {
  return (text ?? '').split(/\n|·|•/).map((x) => x.trim()).filter(Boolean);
}

/**
 * VIP progress (features §6): current tier, a bar to the next tier,
 * "باقي لك X نقطة لـ …" and what the next tier gives. Signed in and flag on only.
 */
export function VipCard({ style }: { style?: object }) {
  const { tr, isAr } = useLang();
  const { loggedIn } = useAuth();
  const flag = useFeature('vip_progress');
  const [b, setB] = useState<Balance | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!loggedIn || !flag.on) return;
      api.get<Balance>('/customer/loyalty/balance').then(setB).catch(() => undefined);
    }, [loggedIn, flag.on]),
  );

  if (!loggedIn || !flag.on || !b?.tier) return null;
  const nameOf = (t?: Tier | null) => (t ? (isAr ? t.name_ar : t.name_en) || t.name || t.name_ar || t.name_en || '' : '');
  const tier = b.tier;
  const next = b.next_tier ?? null;
  const pts = num(b.tier_points);
  const from = num(tier.min_points);
  const to = next ? num(next.min_points) : from;
  const progress = Math.min(1, Math.max(0, b.progress !== undefined && b.progress !== null ? num(b.progress) : next && to > from ? (pts - from) / (to - from) : 1));
  const left = Math.max(0, Math.ceil(num(b.to_next, next ? to - pts : 0)));
  const look = tierLook(`${tier.name_en ?? ''} ${tier.name_ar ?? ''} ${tier.name ?? ''}`);
  const perks = lines(isAr ? next?.benefits_ar : next?.benefits_en).slice(0, 3);

  return (
    <Pressable onPress={() => router.push('/loyalty')} accessibilityRole="button" style={[{ marginHorizontal: S.gutter }, style]}>
      <LinearGradient colors={look.bg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 20, gap: 12 }}>
        <View style={{ position: 'absolute', top: 7, left: 7, right: 7, bottom: 7, borderWidth: 0.7, borderColor: look.line, opacity: 0.45 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <T latin size={10.5} spacing={3} color={look.soft}>GH VIP</T>
          <Icon name="crown" size={18} color={look.soft} stroke={1.2} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
          <T serif size={28} color={look.ink} lh={32} lines={1} style={{ flexShrink: 1 }}>{nameOf(tier)}</T>
          <T latin size={12} color={look.sub}>{`${pts.toLocaleString('en-US')} ${tr('نقطة', 'pts')}`}</T>
        </View>
        <View style={{ height: 3, backgroundColor: 'rgba(127,127,127,0.3)' }}>
          <View style={{ width: `${progress * 100}%`, height: 3, backgroundColor: look.line }} />
        </View>
        {next ? (
          <T size={13} color={look.ink}>
            {tr(`باقي لك ${left.toLocaleString('en-US')} نقطة لـ ${nameOf(next)}`, `${left.toLocaleString('en-US')} points to ${nameOf(next)}`)}
          </T>
        ) : (
          <T size={13} color={look.ink}>{tr('وصلت أعلى مستوى 🤍', 'You are at the top tier 🤍')}</T>
        )}
        {perks.length ? (
          <View style={{ gap: 5 }}>
            <T size={11.5} color={look.sub}>{tr(`مع ${nameOf(next)} تحصل على`, `With ${nameOf(next)} you get`)}</T>
            {perks.map((p, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                <View style={{ width: 4, height: 4, backgroundColor: look.soft, marginTop: 9, transform: [{ rotate: '45deg' }] }} />
                <T size={12.5} color={look.sub} style={{ flex: 1 }}>{p}</T>
              </View>
            ))}
          </View>
        ) : null}
      </LinearGradient>
    </Pressable>
  );
}

/**
 * Just the progress to the next tier (bar + "باقي لك X نقطة لـ …"), to sit
 * inside the member card on Account. Signed in and vip_progress on only.
 */
export function VipProgress({ look }: { look: { ink: string; sub: string; line: string } }) {
  const { tr, isAr } = useLang();
  const { loggedIn } = useAuth();
  const flag = useFeature('vip_progress');
  const [b, setB] = useState<Balance | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!loggedIn || !flag.on) return;
      api.get<Balance>('/customer/loyalty/balance').then(setB).catch(() => undefined);
    }, [loggedIn, flag.on]),
  );

  if (!loggedIn || !flag.on || !b?.tier) return null;
  const nameOf = (t?: Tier | null) => (t ? (isAr ? t.name_ar : t.name_en) || t.name || t.name_ar || t.name_en || '' : '');
  const tier = b.tier;
  const next = b.next_tier ?? null;
  const pts = num(b.tier_points);
  const from = num(tier.min_points);
  const to = next ? num(next.min_points) : from;
  const progress = Math.min(1, Math.max(0, b.progress !== undefined && b.progress !== null ? num(b.progress) : next && to > from ? (pts - from) / (to - from) : 1));
  const left = Math.max(0, Math.ceil(num(b.to_next, next ? to - pts : 0)));

  return (
    <View style={{ gap: 8, marginTop: 14 }}>
      <View style={{ height: 3, backgroundColor: 'rgba(127,127,127,0.3)' }}>
        <View style={{ width: `${progress * 100}%`, height: 3, backgroundColor: look.line }} />
      </View>
      <T size={12.5} color={look.sub}>
        {next
          ? tr(`باقي لك ${left.toLocaleString('en-US')} نقطة لـ ${nameOf(next)}`, `${left.toLocaleString('en-US')} points to ${nameOf(next)}`)
          : tr('وصلت أعلى مستوى 🤍', 'You are at the top tier 🤍')}
      </T>
    </View>
  );
}
