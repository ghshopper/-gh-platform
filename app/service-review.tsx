import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { api } from '@/api';
import { useAuth } from '@/auth';
import { useFeature } from '@/features';
import { useLang } from '@/lang';
import { Stars } from '@/reviews';
import { C, F, S } from '@/theme';
import { Btn, Empty, Header, Kicker, T } from '@/ui';

/** "كيف كانت تجربتك معنا؟" — rate the service for one delivered order (features §8). */
export default function ServiceReview() {
  const p = useLocalSearchParams<{ ps_order_id?: string; order_id?: string; invoice_no?: string; rating?: string }>();
  const { tr, isAr } = useLang();
  const { loggedIn } = useAuth();
  const flag = useFeature('reviews');
  const [rating, setRating] = useState(Number(p.rating) || 0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const send = async () => {
    if (!rating) return Alert.alert(tr('اختر عدد النجوم', 'Choose a rating'));
    setBusy(true);
    try {
      await api.post('/customer/service-reviews', {
        rating,
        comment: comment.trim() || null,
        ps_order_id: p.ps_order_id || undefined,
        order_id: p.order_id ? Number(p.order_id) || p.order_id : undefined,
      });
      setDone(true);
    } catch (e) {
      Alert.alert(tr('ما قدرنا نرسل التقييم', 'Could not send your review'), e instanceof Error ? e.message : '');
    } finally {
      setBusy(false);
    }
  };

  if (!flag.on || flag.service === false || !loggedIn) {
    return (
      <View style={{ flex: 1, backgroundColor: C.white }}>
        <Header close title="" />
        <Empty icon="star" title={!loggedIn ? tr('سجّل دخولك', 'Sign in') : tr('التقييم غير متاح حالياً', 'Reviews are not available right now')}
          action={!loggedIn ? tr('تسجيل الدخول', 'Sign in') : undefined} onAction={() => router.push('/login')} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.white }}>
      <Header close title="" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {done ? (
          <View style={{ padding: 30, alignItems: 'center', gap: 12, marginTop: 40 }}>
            <Stars value={rating} size={26} color={C.gold} />
            <T size={22} w="medium" center>{tr('شكراً لك 🤍', 'Thank you 🤍')}</T>
            <T size={14} color={C.sub} center>{tr('رأيك يساعدنا نخدمك أحسن.', 'Your feedback helps us serve you better.')}</T>
            <Btn label={tr('العودة', 'Done')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={{ alignSelf: 'stretch', marginTop: 20 }} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: S.gutter + 2, gap: 18 }} keyboardShouldPersistTaps="handled">
            <View style={{ gap: 4 }}>
              <Kicker color={C.gold}>YOUR EXPERIENCE</Kicker>
              <T size={26} w="medium">{tr('كيف كانت تجربتك معنا؟', 'How was your experience?')}</T>
              {p.invoice_no ? <T size={13} color={C.muted}>{tr(`طلب ${p.invoice_no}`, `Order ${p.invoice_no}`)}</T> : null}
            </View>
            <Stars value={rating} size={34} color={C.gold} onChange={setRating} />
            <TextInput value={comment} onChangeText={setComment} multiline placeholder={tr('احكِ لنا عن تجربتك (اختياري)', 'Tell us about it (optional)')} placeholderTextColor={C.faint}
              style={{ minHeight: 120, borderWidth: 1, borderColor: C.lineStrong, padding: 12, fontFamily: F.regular, fontSize: 14, color: C.ink, textAlignVertical: 'top', textAlign: isAr ? 'right' : 'left' }} />
            <Btn label={tr('إرسال', 'Send')} loading={busy} onPress={send} />
            <T size={12} color={C.muted}>{tr('يظهر تقييمك بعد المراجعة.', 'Your review appears after approval.')}</T>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}
