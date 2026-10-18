import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { api } from '@/api';
import { useLang } from '@/lang';
import { C, S } from '@/theme';
import { Btn, Field, Header, T } from '@/ui';

const STORE_STATUS: Record<string, [string, string]> = {
  pending: ['قيد الانتظار', 'Pending'],
  confirmed: ['تم تأكيد الطلب', 'Confirmed'],
  processing: ['قيد التجهيز', 'Processing'],
  shipped: ['تم الشحن', 'Shipped'],
  out_for_delivery: ['خرج للتوصيل', 'Out for delivery'],
  delivered: ['تم التسليم', 'Delivered'],
  cancelled: ['ملغي', 'Cancelled'],
  returned: ['مسترجع', 'Returned'],
};

export default function Track() {
  const { tr, isAr } = useLang();
  const [number, setNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ status?: string; tracking_number?: string | null; shipping_company?: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const go = async () => {
    const n = number.trim().toUpperCase();
    if (!n) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await api.get<{ data?: typeof result } & NonNullable<typeof result>>(`/customer/orders/track/${encodeURIComponent(n)}`);
      setResult(r?.data ?? r);
    } catch {
      setError(tr('ما لقينا طلب بهذا الرقم', 'No order with this number'));
    } finally {
      setBusy(false);
    }
  };

  const st = result?.status ? STORE_STATUS[result.status] : undefined;
  return (
    <View style={{ flex: 1, backgroundColor: C.white }}>
      <Header title={tr('تتبع طلب', 'Track an order')} />
      <ScrollView contentContainerStyle={{ padding: S.gutter, gap: 16 }} keyboardShouldPersistTaps="handled">
        <T size={13.5} color={C.sub}>{tr('اكتب رقم الطلب اللي وصلك (مثل ORD-…)', 'Enter your order number (like ORD-…)')}</T>
        <Field label={tr('رقم الطلب', 'Order number')} value={number} onChangeText={setNumber} autoCapitalize="characters" ltr onSubmitEditing={go} />
        <Btn label={tr('تتبع', 'Track')} loading={busy} onPress={go} />
        {error ? <T size={13} color={C.red}>{error}</T> : null}
        {result ? (
          <View style={{ backgroundColor: C.surface2, padding: 18, gap: 6 }}>
            <T size={12.5} color={C.muted}>{tr('حالة الطلب', 'Status')}</T>
            <T size={20} w="medium">{st ? (isAr ? st[0] : st[1]) : result.status}</T>
            {result.shipping_company ? <T size={13}>{tr('شركة الشحن: ', 'Carrier: ')}{result.shipping_company}</T> : null}
            {result.tracking_number ? <T latin size={13}>{tr('رقم التتبع: ', 'Tracking no.: ')}{result.tracking_number}</T> : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
