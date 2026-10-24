import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/api';
import { Icon } from '@/icons';
import { useLang } from '@/lang';
import { C } from '@/theme';
import { Btn, Kicker, T } from '@/ui';

interface BankDetails { bank_name?: string; account_name?: string; account_number?: string; iban?: string; note?: string }

export default function OrderPlaced() {
  const { number, gift, paid, bank, check, due } = useLocalSearchParams<{ number?: string; gift?: string; paid?: string; bank?: string; check?: string; due?: string }>();
  const insets = useSafeAreaInsets();
  const { tr } = useLang();
  const isBank = bank === '1';
  const [details, setDetails] = useState<BankDetails | null>(null);
  useEffect(() => {
    if (!isBank) return;
    api.get<{ data?: { code: string; details?: BankDetails }[] }>('/customer/payment-gateways')
      .then((r) => setDetails((r?.data ?? []).find((g) => g.code === 'bank_transfer')?.details ?? null))
      .catch(() => undefined);
  }, [isBank]);

  const line = (label: string, value?: string, copy = false) => value ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line }}>
      <T size={12.5} color={C.sub} style={{ width: 92 }}>{label}</T>
      <T size={14} w="medium" style={{ flex: 1 }} ltr={copy}>{value}</T>
      {copy ? (
        <Pressable onPress={() => Clipboard.setStringAsync(value)} hitSlop={8}>
          <T size={12} color={C.sub} style={{ textDecorationLine: 'underline' }}>{tr('نسخ', 'Copy')}</T>
        </Pressable>
      ) : null}
    </View>
  ) : null;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.white }} contentContainerStyle={{ paddingTop: insets.top + 60, paddingBottom: insets.bottom + 30, paddingHorizontal: 28, alignItems: 'center', gap: 14 }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, borderWidth: 1, borderColor: C.ink, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="check" size={34} stroke={1.4} />
      </View>
      <Kicker center>THANK YOU</Kicker>
      <T size={24} w="medium" center>{isBank ? tr('طلبك محفوظ، باقي التحويل', 'Order saved — transfer pending') : tr('تم استلام طلبك', 'Your order is in')}</T>
      {number ? <T latin size={15} spacing={1.5} center>{number}</T> : null}
      {isBank ? (
        <View style={{ alignSelf: 'stretch', borderWidth: 1, borderColor: C.line, padding: 16, gap: 4 }}>
          <T size={13} color={C.sub}>{tr('حوّل الإجمالي للحساب التالي، واكتب رقم الطلب في وصف التحويل:', 'Transfer the total to this account, with the order number as the reference:')}</T>
          {line(tr('البنك', 'Bank'), details?.bank_name)}
          {line(tr('اسم الحساب', 'Account name'), details?.account_name)}
          {line(tr('رقم الحساب', 'Account no.'), details?.account_number, true)}
          {line('IBAN', details?.iban, true)}
          {details?.note ? <T size={12.5} color={C.sub} style={{ marginTop: 6 }}>{details.note}</T> : null}
          <View style={{ marginTop: 12 }}>
            <Btn label={tr('أرسل إيصال التحويل', 'Send the transfer receipt')} onPress={() => Linking.openURL(`https://wa.me/96877246972?text=${encodeURIComponent(`إيصال التحويل للطلب ${number ?? ''}`)}`)} />
          </View>
        </View>
      ) : (
        <T size={14} color={C.sub} center>
          {paid ? tr('تم الدفع بنجاح. ', 'Payment received. ') : ''}
          {!paid && check ? tr('وصلتنا دفعتك وبنتأكد منها. ', 'We received your payment and are confirming it. ') : ''}
          {!paid && check && Number(due) > 0 ? tr(`باقي عليك ${Number(due).toFixed(3)} ر.ع وبنتواصل معك. `, `${Number(due).toFixed(3)} OMR is still due; we'll contact you. `) : ''}
          {gift ? tr(`بنجهّز هديتك لـ ${gift} بتغليف فاخر.`, `We'll gift-wrap it for ${gift}.`) : tr('طلبك قيد التجهيز الآن، شكراً لثقتك.', "We're preparing your order. Thank you.")}
        </T>
      )}
      <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 20 }}>
        <Btn label={tr('طلباتي', 'My orders')} onPress={() => router.replace('/orders')} />
        <Btn kind="outline" label={tr('متابعة التسوق', 'Continue shopping')} onPress={() => router.replace('/')} />
      </View>
    </ScrollView>
  );
}
