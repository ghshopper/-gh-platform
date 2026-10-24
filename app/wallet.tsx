import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { useAuth } from '@/auth';
import { useFeature } from '@/features';
import { dateText, num, omrReal } from '@/format';
import { useLoad } from '@/hooks';
import { Icon } from '@/icons';
import { useLang } from '@/lang';
import { C, F, S } from '@/theme';
import { Btn, Empty, ErrorBox, Header, Kicker, Loader, Segments, T } from '@/ui';
import { convertPoints, fetchWallet, redeemGift, topUpWallet, WALLET_TYPE } from '@/wallet';

const CARD = '#350304';
const GOLD = '#D6B08C';
const AMOUNTS = [10, 25, 50, 100];

/** محفظة GH ("رصيدك" in the UI): balance, history, gift card, convert points, top up by card / Apple Pay. */
export default function Wallet() {
  const { tr, isAr } = useLang();
  const { loggedIn, refresh } = useAuth();
  const flag = useFeature('wallet');
  const q = useLoad(fetchWallet, [loggedIn, flag.on]);
  const w = q.data;

  const [amount, setAmount] = useState('25');
  const [via, setVia] = useState<'apple' | 'card'>('apple');
  const [paying, setPaying] = useState(false);
  const [pts, setPts] = useState('');
  const [converting, setConverting] = useState(false);
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [codeErr, setCodeErr] = useState<string | null>(null);

  if (!flag.on) {
    return (
      <View style={{ flex: 1, backgroundColor: C.white }}>
        <Header title={tr('رصيدك', 'My balance')} />
        <Empty icon="card" title={tr('الرصيد غير متاح حالياً', 'Your balance is not available right now')} />
      </View>
    );
  }
  if (!loggedIn) {
    return (
      <View style={{ flex: 1, backgroundColor: C.white }}>
        <Header title={tr('رصيدك', 'My balance')} />
        <Empty icon="card" title={tr('سجّل دخولك', 'Sign in')} text={tr('عشان تشوف رصيدك', 'to see your balance')} action={tr('تسجيل الدخول', 'Sign in')} onAction={() => router.push('/login')} />
      </View>
    );
  }

  const min = w?.topup_min ?? num(flag.topup_min, 5);
  const max = w?.topup_max ?? num(flag.topup_max, 1000);
  const value = Number(amount) || 0;
  const custom = !AMOUNTS.includes(value);
  const canTopup = (w?.topup ?? true) && flag.topup !== false;
  const canConvert = (w?.points_convert ?? true) && flag.points_convert !== false && (w?.points ?? 0) > 0;
  const ptsNum = Math.floor(Number(pts) || 0);
  const ptsWorth = Math.round(ptsNum * (w?.point_value ?? 0) * 1000) / 1000;

  const topUp = async () => {
    if (value < min || value > max) {
      Alert.alert(tr('المبلغ', 'Amount'), tr(`اختر مبلغ بين ${omrReal(min)} و ${omrReal(max)}`, `Choose between ${omrReal(min)} and ${omrReal(max)}`));
      return;
    }
    setPaying(true);
    try {
      const r = await topUpWallet(value, via === 'apple', isAr);
      if (r.paid) {
        Alert.alert(tr('تم الشحن 🤍', 'Topped up 🤍'), tr(`رصيدك الحين ${omrReal(r.balance)}`, `Your balance is now ${omrReal(r.balance)}`));
      } else if (!r.cancelled) {
        Alert.alert(tr('لم يكتمل الشحن', 'Top-up not completed'), tr('ما انخصم شي. حاول مرة ثانية.', 'Nothing was charged. Please try again.'));
      }
      q.reload();
    } catch (e) {
      Alert.alert(tr('لم يكتمل الشحن', 'Top-up not completed'), e instanceof Error ? e.message : '');
      q.reload();
    } finally {
      setPaying(false);
    }
  };

  const convert = async () => {
    if (ptsNum <= 0 || ptsNum > (w?.points ?? 0)) {
      Alert.alert(tr('النقاط', 'Points'), tr(`اكتب عدد نقاط حتى ${(w?.points ?? 0).toLocaleString('en-US')}`, `Enter up to ${(w?.points ?? 0).toLocaleString('en-US')} points`));
      return;
    }
    setConverting(true);
    try {
      const r = await convertPoints(ptsNum);
      setPts('');
      Alert.alert(tr('تم التحويل', 'Converted'), tr(`انضاف ${omrReal(ptsWorth)} لرصيدك. رصيدك الحين ${omrReal(r.balance)}`, `${omrReal(ptsWorth)} added. Balance ${omrReal(r.balance)}`));
      q.reload();
      refresh().catch(() => undefined);
    } catch (e) {
      Alert.alert(tr('ما قدرنا نحوّل النقاط', 'Could not convert points'), e instanceof Error ? e.message : '');
    } finally {
      setConverting(false);
    }
  };

  const redeem = async () => {
    if (!code.trim()) return;
    setRedeeming(true);
    setCodeErr(null);
    try {
      const r = await redeemGift(code);
      setCode('');
      Alert.alert(tr('تمت الإضافة 🤍', 'Added 🤍'), tr(`انضاف ${omrReal(r.added)} لرصيدك. رصيدك الحين ${omrReal(r.balance)}`, `${omrReal(r.added)} added. Your balance is now ${omrReal(r.balance)}`));
      q.reload();
    } catch (e) {
      setCodeErr(e instanceof Error ? e.message : tr('الكود غير صحيح أو مستخدم', 'Invalid or used code'));
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.white }}>
      <Header title={tr('رصيدك', 'My balance')} />
      {q.loading && !w ? <Loader /> : q.error && !w ? <ErrorBox message={q.error} onRetry={q.reload} /> : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ padding: S.gutter, gap: 18, paddingBottom: 60 }} keyboardShouldPersistTaps="handled"
            refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.reload} />}>
            {/* balance card */}
            <LinearGradient colors={['#4A0709', CARD, '#1E0102']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ aspectRatio: 1.7, padding: 22, justifyContent: 'space-between' }}>
              <View style={{ position: 'absolute', top: 8, left: 8, right: 8, bottom: 8, borderWidth: 0.7, borderColor: GOLD, opacity: 0.45 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <T latin size={11} spacing={3} color={GOLD}>GH WALLET</T>
                <Icon name="card" size={20} color={GOLD} stroke={1.2} />
              </View>
              <View style={{ gap: 2 }}>
                <T size={12.5} color="rgba(246,233,216,0.7)">{tr('رصيدك', 'Your balance')}</T>
                <T latin size={36} color="#F6E9D8" lh={42}>{omrReal(w?.balance ?? 0)}</T>
                <T size={12} color="rgba(246,233,216,0.7)">{tr('تستخدمه في الدفع وقت الطلب', 'Use it when you pay for an order')}</T>
              </View>
            </LinearGradient>

            {/* top up */}
            {canTopup ? (
              <View style={{ gap: 12 }}>
                <Kicker>{tr('شحن الرصيد', 'TOP UP')}</Kicker>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {AMOUNTS.filter((a) => a >= min && a <= max).map((a) => {
                    const on = value === a;
                    return (
                      <Pressable key={a} onPress={() => setAmount(String(a))} accessibilityRole="button" accessibilityState={{ selected: on }}
                        style={{ height: 42, paddingHorizontal: 16, justifyContent: 'center', borderWidth: 1, borderColor: on ? C.ink : C.line, backgroundColor: on ? C.ink : C.white }}>
                        <T latin size={13.5} color={on ? C.white : C.ink}>{omrReal(a)}</T>
                      </Pressable>
                    );
                  })}
                  <TextInput value={custom ? amount : ''} onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad"
                    placeholder={tr('مبلغ آخر', 'Other')} placeholderTextColor={C.muted}
                    style={{ height: 42, minWidth: 96, paddingHorizontal: 12, borderWidth: 1, borderColor: custom && amount ? C.ink : C.line, color: C.ink, textAlign: 'center', fontFamily: F.latin }} />
                </View>
                <T size={12} color={C.muted}>{tr(`من ${omrReal(min)} إلى ${omrReal(max)}`, `From ${omrReal(min)} to ${omrReal(max)}`)}</T>
                <Segments value={via} onChange={setVia} options={[
                  { key: 'apple', label: Platform.OS === 'ios' ? 'Apple Pay' : 'Google Pay' },
                  { key: 'card', label: tr('البطاقة البنكية', 'Card') },
                ]} />
                <Btn label={tr(`اشحن ${omrReal(value)}`, `Top up ${omrReal(value)}`)} loading={paying} onPress={topUp} />
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Icon name="lock" size={14} color={C.muted} />
                  <T size={11.5} color={C.muted}>{tr('دفع آمن عبر أموال', 'Secure payment by Amwal')}</T>
                </View>
              </View>
            ) : null}

            {/* gift card → balance */}
            <View style={{ gap: 12, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 20 }}>
              <Kicker>{tr('استخدم بطاقة هدية', 'USE A GIFT CARD')}</Kicker>
              <T size={13} color={C.sub}>{tr('رصيد البطاقة كامل ينضاف لرصيدك، وتستخدمه على أي طلب.', "The card's whole balance is added to yours, to use on any order.")}</T>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput value={code} onChangeText={(v) => { setCode(v.toUpperCase()); setCodeErr(null); }} autoCapitalize="characters" autoCorrect={false}
                  placeholder="GH-XXXX-XXXX" placeholderTextColor={C.muted}
                  style={{ flex: 1, height: 48, paddingHorizontal: 12, borderWidth: 1, borderColor: codeErr ? C.red : C.line, color: C.ink, textAlign: 'left', fontFamily: F.latin }} />
                <Btn kind="outline" height={48} label={tr('أضف', 'Add')} loading={redeeming} disabled={!code.trim()} onPress={redeem} style={{ paddingHorizontal: 18 }} />
              </View>
              {codeErr ? <T size={12.5} color={C.red}>{codeErr}</T> : null}
            </View>

            {/* points → wallet */}
            {canConvert ? (
              <View style={{ gap: 12, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 20 }}>
                <Kicker>{tr('حوّل نقاطك', 'CONVERT POINTS')}</Kicker>
                <T size={13.5}>
                  {tr(`عندك ${(w?.points ?? 0).toLocaleString('en-US')} نقطة = ${omrReal((w?.points ?? 0) * (w?.point_value ?? 0))}`, `You have ${(w?.points ?? 0).toLocaleString('en-US')} points = ${omrReal((w?.points ?? 0) * (w?.point_value ?? 0))}`)}
                </T>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput value={pts} onChangeText={(v) => setPts(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad"
                    placeholder={tr('عدد النقاط', 'Points')} placeholderTextColor={C.muted}
                    style={{ flex: 1, height: 48, paddingHorizontal: 12, borderWidth: 1, borderColor: C.line, color: C.ink, textAlign: 'center', fontFamily: F.latin }} />
                  <Btn kind="outline" height={48} label={tr('الكل', 'All')} onPress={() => setPts(String(w?.points ?? 0))} style={{ paddingHorizontal: 16 }} />
                </View>
                {ptsNum > 0 ? <T size={12.5} color={C.sub}>{tr(`بينضاف لرصيدك ${omrReal(ptsWorth)}`, `${omrReal(ptsWorth)} will be added`)}</T> : null}
                <Btn kind="outline" label={tr('حوّلها لرصيدك', 'Add to my balance')} loading={converting} disabled={ptsNum <= 0} onPress={convert} />
              </View>
            ) : null}

            {/* history */}
            <View style={{ gap: 4, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 20 }}>
              <T size={17} w="medium" style={{ marginBottom: 6 }}>{tr('حركة الرصيد', 'Balance activity')}</T>
              {!(w?.transactions ?? []).length ? (
                <T size={13} color={C.muted}>{tr('ما فيه حركات للحين.', 'No activity yet.')}</T>
              ) : (
                (w?.transactions ?? []).map((t) => {
                  const amt = num(t.amount);
                  const plus = amt > 0;
                  const known = WALLET_TYPE[t.type];
                  const label = (isAr ? t.type_label_ar : null) || (known ? tr(known[0], known[1]) : t.type_label_ar || t.type);
                  return (
                    <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line }}>
                      <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: plus ? C.greenSoft : C.surface }}>
                        <Icon name={plus ? 'plus' : 'minus'} size={15} color={plus ? C.green : C.red} stroke={1.8} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <T size={13.5} w="medium" lines={1}>{label}{t.order_number ? ` · ${t.order_number}` : ''}</T>
                        <T size={11.5} color={C.muted} lines={1}>{[dateText(t.created_at, isAr), t.note].filter(Boolean).join(' · ')}</T>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <T latin size={14} w="medium" color={plus ? C.green : C.red}>{`${plus ? '+' : '−'}${omrReal(Math.abs(amt))}`}</T>
                        {t.balance_after !== undefined && t.balance_after !== null ? <T latin size={11} color={C.faint}>{omrReal(t.balance_after)}</T> : null}
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}
