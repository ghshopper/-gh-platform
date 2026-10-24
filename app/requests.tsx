import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, TextInput, View } from 'react-native';
import { api, imageUrl, listOf } from '@/api';
import { useAuth } from '@/auth';
import { useFeature } from '@/features';
import { dateText, num, omrReal } from '@/format';
import { useLoad } from '@/hooks';
import { Icon } from '@/icons';
import { useLang } from '@/lang';
import { C, F, S } from '@/theme';
import { BrandText, Btn, Empty, ErrorBox, Header, Kicker, Loader, Photo, SummaryRow, T } from '@/ui';
import { payPsOrder } from '@/wallet';

interface Quote {
  price: number | string;
  note?: string | null;
  deposit?: number | string | null;
  delivery_fee?: number | string | null;
  delivery_method?: string | null;
  total?: number | string | null;
  status: 'sent' | 'accepted' | 'declined' | 'expired' | string;
  expires_at?: string | null;
  expired?: boolean;
}

interface PieceRequest {
  id: number;
  product_name?: string | null;
  brand?: string | null;
  details?: string | null;
  image_url?: string | null;
  product_url?: string | null;
  status: string;
  status_label_ar?: string | null;
  created_at?: string | null;
  quote?: Quote | null;
  order?: { id: string | number; pay_token?: string | null; pay_url?: string | null; invoice_no?: string | null; paid?: boolean } | null;
}

const STATUS_EN: Record<string, string> = {
  pending: 'Received',
  reviewing: 'Looking for it',
  found: 'Found',
  not_found: 'Not found',
  ordered: 'Ordered',
  cancelled: 'Cancelled',
};
const STATUS_AR: Record<string, string> = {
  pending: 'استلمنا طلبك',
  reviewing: 'نبحث عنها',
  found: 'لقيناها',
  not_found: 'ما لقيناها',
  ordered: 'تم الطلب',
  cancelled: 'ملغي',
};
const METHOD: Record<string, [string, string]> = {
  home: ['مندوبنا لباب البيت', 'Our driver to your door'],
  genacom: ['جيناكم لباب البيت', 'Genacom to your door'],
  genacom_office: ['استلام من مكتب جيناكم', 'Genacom office pickup'],
};

function QuoteCard({ r, onChanged, onDecline }: { r: PieceRequest; onChanged: () => void; onDecline: (r: PieceRequest) => void }) {
  const { tr, isAr } = useLang();
  const wallet = useFeature('wallet');
  const [busy, setBusy] = useState(false);
  const q = r.quote as Quote;
  const price = num(q.price);
  const fee = num(q.delivery_fee);
  const total = num(q.total, price + fee);
  const deposit = num(q.deposit);
  const expired = !!q.expired || q.status === 'expired';
  const open = q.status === 'sent' && !expired;
  const method = q.delivery_method ? METHOD[q.delivery_method] : undefined;

  const accept = async () => {
    setBusy(true);
    try {
      const res = await api.post<{ order?: { id: string | number; pay_token?: string; pay_url?: string; total?: number } }>(`/customer/product-requests/${r.id}/accept`, {});
      const o = res?.order;
      if (o?.pay_token || o?.pay_url) await payPsOrder({ token: o.pay_token, payUrl: o.pay_url, walletOn: wallet.on, tr });
      onChanged();
    } catch (e) {
      Alert.alert(tr('ما قدرنا نأكد العرض', 'Could not accept the offer'), e instanceof Error ? e.message : '');
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ marginTop: 12, borderWidth: 1, borderColor: open ? C.ink : C.line }}>
      <View style={{ padding: 16, gap: 8, backgroundColor: open ? C.cream : C.surface2 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Kicker color={C.gold}>{tr('عرض السعر', 'YOUR QUOTE')}</Kicker>
          {expired ? <T size={11.5} color={C.red}>{tr('انتهت صلاحية العرض', 'Offer expired')}</T>
            : q.status === 'accepted' ? <T size={11.5} color={C.green}>{tr('قبلت العرض ✓', 'Accepted ✓')}</T>
              : q.status === 'declined' ? <T size={11.5} color={C.muted}>{tr('رفضت العرض', 'Declined')}</T>
                : q.expires_at ? <T size={11.5} color={C.sub}>{tr(`صالح حتى ${dateText(q.expires_at, true)}`, `Valid until ${dateText(q.expires_at, false)}`)}</T> : null}
        </View>
        <SummaryRow label={tr('سعر القطعة', 'Piece')} value={omrReal(price)} />
        {fee > 0 ? <SummaryRow label={method ? tr(`التوصيل · ${method[0]}`, `Delivery · ${method[1]}`) : tr('التوصيل', 'Delivery')} value={omrReal(fee)} /> : null}
        <SummaryRow label={tr('الإجمالي', 'Total')} value={omrReal(total)} strong />
        {deposit > 0 && deposit < total ? (
          <T size={12.5} color={C.sub}>{tr(`تدفع الحين ${omrReal(deposit)} عربون، والباقي ${omrReal(total - deposit)} قبل التسليم`, `Pay ${omrReal(deposit)} now as a deposit and ${omrReal(total - deposit)} before delivery`)}</T>
        ) : null}
        {q.note ? <T size={13} color={C.ink} w="light">{q.note}</T> : null}
      </View>
      {open ? (
        <View style={{ flexDirection: 'row', gap: 10, padding: 12 }}>
          <Btn style={{ flex: 1 }} height={46} label={tr('أكّد واطلب', 'Accept & order')} loading={busy} onPress={accept} />
          <Btn style={{ flex: 0.6 }} height={46} kind="outline" label={tr('لا، شكراً', 'No thanks')} disabled={busy} onPress={() => onDecline(r)} />
        </View>
      ) : null}
      {!open && r.order && !r.order.paid && (r.order.pay_url || r.order.pay_token) ? (
        <View style={{ padding: 12, gap: 6 }}>
          <Btn icon="card" height={46} label={tr('ادفع الآن', 'Pay now')} loading={busy}
            onPress={async () => {
              setBusy(true);
              try {
                await payPsOrder({ token: r.order?.pay_token, payUrl: r.order?.pay_url, walletOn: wallet.on, tr });
              } finally {
                setBusy(false);
                onChanged();
              }
            }} />
          <T size={11.5} color={C.muted} center>{wallet.on ? tr('رصيدك أو بطاقة أو Apple Pay', 'Your balance, card or Apple Pay') : tr('بطاقة أو Apple Pay · دفع آمن عبر أموال', 'Card or Apple Pay · secure payment via Amwal')}</T>
        </View>
      ) : null}
      {r.order?.paid ? (
        <Pressable onPress={() => router.push('/orders')} style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="check" size={16} color={C.green} stroke={2} />
          <T size={13} color={C.green} style={{ flex: 1 }}>{tr(`مدفوع · ${r.order.invoice_no ?? ''}`, `Paid · ${r.order.invoice_no ?? ''}`)}</T>
          <Icon name="forward" size={14} color={C.faint} flip={isAr} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** طلباتي الخاصة: piece requests, their quotes, accept → pay, decline. */
export default function MyRequests() {
  const { tr, isAr } = useLang();
  const { loggedIn } = useAuth();
  const flag = useFeature('quotes');
  const q = useLoad(async () => (loggedIn && flag.on ? listOf<PieceRequest>(await api.get<unknown>('/customer/product-requests')) : []), [loggedIn, flag.on]);
  const [declining, setDeclining] = useState<PieceRequest | null>(null);
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);
  useFocusEffect(useCallback(() => { if (q.data) q.reload(); }, [])); // eslint-disable-line react-hooks/exhaustive-deps

  const decline = async () => {
    if (!declining) return;
    setSending(true);
    try {
      await api.post(`/customer/product-requests/${declining.id}/decline`, { reason: reason.trim() || null });
      setDeclining(null);
      setReason('');
      q.reload();
    } catch (e) {
      Alert.alert(tr('حدث خطأ', 'Something went wrong'), e instanceof Error ? e.message : '');
    } finally {
      setSending(false);
    }
  };

  const title = tr('طلباتي الخاصة', 'My piece requests');
  if (!flag.on || !loggedIn) {
    return (
      <View style={{ flex: 1, backgroundColor: C.white }}>
        <Header title={title} />
        {!loggedIn ? (
          <Empty icon="camera" title={tr('سجّل دخولك', 'Sign in')} text={tr('عشان تتابع طلبات القطع وعروض الأسعار', 'to follow your piece requests and quotes')} action={tr('تسجيل الدخول', 'Sign in')} onAction={() => router.push('/login')} />
        ) : (
          <Empty icon="camera" title={tr('بنرد عليك بالسعر على الواتساب', "We'll WhatsApp you the price")} action={tr('اطلب قطعة', 'Request a piece')} onAction={() => router.push('/request')} />
        )}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.white }}>
      <Header title={title} right={
        <Pressable onPress={() => router.push('/request')} hitSlop={8} style={{ paddingHorizontal: 10 }} accessibilityLabel={tr('اطلب قطعة', 'Request a piece')}>
          <Icon name="plus" size={20} />
        </Pressable>
      } />
      {q.loading && !q.data ? <Loader /> : q.error && !q.data ? <ErrorBox message={q.error} onRetry={q.reload} /> : (
        <FlatList
          data={q.data ?? []}
          keyExtractor={(r) => String(r.id)}
          refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.reload} />}
          contentContainerStyle={{ paddingBottom: 50 }}
          renderItem={({ item: r }) => {
            const label = isAr ? r.status_label_ar || STATUS_AR[r.status] || r.status : STATUS_EN[r.status] || r.status;
            const done = r.status === 'not_found' || r.status === 'cancelled';
            return (
              <View style={{ marginHorizontal: S.gutter, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: C.line }}>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <Photo path={r.image_url ? imageUrl(r.image_url) : null} label={r.brand ?? ''} style={{ width: 64, height: 80 }} />
                  <View style={{ flex: 1, gap: 2 }}>
                    {r.brand ? <BrandText size={11}>{r.brand}</BrandText> : null}
                    <T size={14} lines={2}>{r.product_name || tr('قطعة من الصورة', 'Piece from a photo')}</T>
                    {r.details ? <T size={12} color={C.muted} lines={2}>{r.details}</T> : null}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <View style={{ paddingHorizontal: 8, paddingVertical: 2, backgroundColor: r.quote?.status === 'sent' && !r.quote.expired ? C.ink : done ? C.surface : C.surface }}>
                        <T size={11} color={r.quote?.status === 'sent' && !r.quote.expired ? C.white : done ? C.muted : C.ink}>
                          {r.quote?.status === 'sent' && !r.quote.expired ? tr('السعر جاهز ✨', 'Price ready ✨') : label}
                        </T>
                      </View>
                      <T size={11.5} color={C.faint}>{dateText(r.created_at, isAr)}</T>
                    </View>
                  </View>
                </View>
                {r.quote ? <QuoteCard r={r} onChanged={q.reload} onDecline={(x) => { setReason(''); setDeclining(x); }} /> : null}
              </View>
            );
          }}
          ListEmptyComponent={<Empty icon="camera" title={tr('ما عندك طلبات للحين', 'No requests yet')} text={tr('صوّر القطعة أو الصق رابطها ونجيبها لك', 'Snap it or paste the link and we get it for you')} action={tr('اطلب قطعة', 'Request a piece')} onAction={() => router.push('/request')} />}
        />
      )}

      {/* decline with an optional reason */}
      <Modal visible={!!declining} transparent animationType="fade" onRequestClose={() => setDeclining(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: C.scrim }}>
          <View style={{ backgroundColor: C.bg, padding: 22, gap: 14, direction: isAr ? 'rtl' : 'ltr' }}>
            <T size={17} w="medium">{tr('ما يناسبك العرض؟', 'Not for you?')}</T>
            <T size={13} color={C.sub}>{tr('قول لنا السبب (اختياري) عشان نخدمك أحسن.', 'Tell us why (optional) so we can do better.')}</T>
            <TextInput value={reason} onChangeText={setReason} multiline placeholder={tr('مثلاً: السعر أعلى من المتوقع', 'e.g. the price is higher than expected')} placeholderTextColor={C.faint}
              style={{ minHeight: 80, borderWidth: 1, borderColor: C.lineStrong, padding: 12, fontFamily: F.regular, fontSize: 14, color: C.ink, textAlignVertical: 'top', textAlign: isAr ? 'right' : 'left' }} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Btn style={{ flex: 1 }} height={46} label={tr('رفض العرض', 'Decline')} loading={sending} onPress={decline} />
              <Btn style={{ flex: 1 }} height={46} kind="outline" label={tr('رجوع', 'Back')} onPress={() => setDeclining(null)} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
