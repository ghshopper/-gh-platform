import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Dimensions, Linking, Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SITE_BASE } from '@/api';
import { dateText, omrReal, waNumber } from '@/format';
import { Icon } from '@/icons';
import { useLang } from '@/lang';
import { CARRIER, cachedOrder, cachedOrders, fetchMyOrders, STATUS } from '@/orders';
import { C, S } from '@/theme';
import { BrandText, Btn, Divider, Empty, Header, Loader, Photo, SummaryRow, T } from '@/ui';
import { useAuth } from '@/auth';
import { useFeatures } from '@/features';
import { useLoad } from '@/hooks';
import { payPsOrder } from '@/wallet';

const W = Dimensions.get('window').width;
const STEPS = [
  { ar: 'استلمناه', en: 'Received' },
  { ar: 'اشتريناه', en: 'Bought' },
  { ar: 'وصل عُمان', en: 'In Oman' },
  { ar: 'في الطريق', en: 'On the way' },
  { ar: 'تم التسليم', en: 'Delivered' },
];

export default function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { tr, isAr } = useLang();
  const f = useFeatures();
  const { loggedIn } = useAuth();
  // opened from a push (e.g. the purchase photo) before the orders list was loaded
  const loader = useLoad(async () => (cachedOrder(id) ? null : fetchMyOrders()), [id]);
  const o = cachedOrder(id);
  const company = cachedOrders()?.company;
  const customer = cachedOrders()?.customer;
  const [invoice, setInvoice] = useState(false);
  const [gallery, setGallery] = useState<{ url: string; caption: string }[] | null>(null);
  const [, setTick] = useState(0);
  // Pay what's left: رصيدك first if there is one, then the secure Amwal page; then refresh the order.
  const pay = async (url: string) => {
    await payPsOrder({ payUrl: url, walletOn: f.wallet.on && loggedIn, tr });
    await fetchMyOrders().catch(() => undefined);
    setTick((t) => t + 1);
  };

  if (!o && loader.loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.white }}>
        <Header title={tr('الطلب', 'Order')} />
        <Loader />
      </View>
    );
  }
  if (!o) {
    return (
      <View style={{ flex: 1, backgroundColor: C.white }}>
        <Header title={tr('الطلب', 'Order')} />
        <Empty title={tr('ما لقينا الطلب', 'Order not found')} />
      </View>
    );
  }

  const st = STATUS[o.status];
  const carrier = o.delivery_method ? CARRIER[o.delivery_method] : undefined;
  const carrierName = carrier ? tr(carrier.ar, carrier.en) : '';
  const trackingUrl = /^https?:\/\//i.test(o.carrier_tracking ?? '') ? (o.carrier_tracking as string) : o.tracking_url || '';
  const trackingIsLink = !!trackingUrl;
  const receipts = o.items.filter((i) => i.receipt_url).map((i) => ({ url: i.receipt_url as string, caption: [i.brand, i.name].filter(Boolean).join(' · ') }));
  const companyWa = waNumber(company?.phone ?? '96877246972');

  const subtitle =
    o.status === 'out_for_delivery'
      ? carrier
        ? carrier.branch
          ? tr(`جاهز للاستلام من فرع ${carrierName} أو في الطريق إليه`, `On its way to the ${carrierName} branch`)
          : tr(`مع ${carrierName} في الطريق إليك`, `With ${carrierName}, on its way`)
        : tr('مندوبنا بيتواصل معك قبل لا يوصل', 'Our driver will call before arriving')
      : o.status === 'delivered'
        ? tr('وصلك طلبك. نتمنى تعجبك 🤍', 'Delivered. We hope you love it 🤍')
        : o.status === 'arrived'
          ? tr('قطعك وصلت عُمان، ونجهزها للتوصيل', 'Your pieces are in Oman and being prepared')
          : o.status === 'purchased'
            ? tr('اشترينا قطعك من البوتيك', 'We bought your pieces at the boutique')
            : tr('بنبدأ بتجهيز طلبك', "We're starting on your order");

  return (
    <View style={{ flex: 1, backgroundColor: C.white }}>
      <Header latinTitle={o.invoice_no} />
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={{ paddingHorizontal: 22, paddingTop: 22 }}>
          <T size={12.5} color={C.muted}>{tr('حالة الطلب', 'Status')}</T>
          <T size={24} w="medium">{tr(st.ar, st.en)}</T>
          <T size={13.5} color={C.sub} w="light">{subtitle}</T>
          <View style={{ flexDirection: 'row', gap: 4, marginTop: 20 }}>
            {STEPS.map((_, i) => <View key={i} style={{ flex: 1, height: 3, backgroundColor: i <= st.step ? C.ink : C.lineStrong }} />)}
          </View>
          <View style={{ flexDirection: 'row', marginTop: 8 }}>
            {STEPS.map((s, i) => (
              <T key={i} size={10.5} center color={i === st.step ? C.ink : C.muted} w={i === st.step ? 'medium' : 'regular'} style={{ flex: 1 }}>{tr(s.ar, s.en)}</T>
            ))}
          </View>
          <T size={12} color={C.muted} style={{ marginTop: 12 }}>{tr(`تاريخ الطلب ${dateText(o.created_at, true)}`, `Ordered ${dateText(o.created_at, false)}`)}</T>
        </View>

        {o.driver && o.status === 'out_for_delivery' && !carrier ? (
          <View style={{ margin: 22, marginBottom: 0, padding: 14, backgroundColor: C.surface2, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }}>
              <T size={16} color={C.white} center>{o.driver.name.charAt(0)}</T>
            </View>
            <View style={{ flex: 1 }}>
              <T size={12} color={C.muted}>{tr('المندوب', 'Driver')}</T>
              <T size={15} w="medium">{o.driver.name}</T>
            </View>
            {o.driver.phone ? (
              <>
                <Pressable onPress={() => Linking.openURL(`tel:${o.driver?.phone}`)} accessibilityLabel={tr('اتصال بالمندوب', 'Call driver')}
                  style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.white, borderWidth: 1, borderColor: C.lineStrong, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="phone" size={18} stroke={1.5} />
                </Pressable>
                <Pressable onPress={() => Linking.openURL(`https://wa.me/${waNumber(o.driver?.phone)}`)} accessibilityLabel={tr('واتساب المندوب', 'WhatsApp driver')}
                  style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.white, borderWidth: 1, borderColor: C.lineStrong, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="whatsapp" size={18} stroke={1.5} />
                </Pressable>
              </>
            ) : null}
          </View>
        ) : null}

        {carrier ? (
          <View style={{ margin: 22, marginBottom: 0, padding: 14, backgroundColor: C.surface2, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Icon name="box" size={20} stroke={1.3} />
              <T size={14} w="medium" style={{ flex: 1 }}>
                {carrier.branch ? tr(`استلام من فرع ${carrierName}`, `Pickup at ${carrierName} branch`) : tr(`الشحن مع ${carrierName} لباب البيت`, `${carrierName} to your door`)}
              </T>
            </View>
            {o.carrier_tracking ? (
              trackingIsLink ? (
                <View style={{ gap: 6 }}>
                  {!/^https?:/i.test(o.carrier_tracking) ? <T latin size={14}>{tr('رقم الشحنة: ', 'Shipment no.: ')}{o.carrier_tracking}</T> : null}
                  <Btn kind="outline" height={44} icon="box" label={tr(`تتبّع الشحنة مع ${carrierName}`, `Track with ${carrierName}`)} onPress={() => WebBrowser.openBrowserAsync(trackingUrl)} />
                </View>
              ) : (
                <T latin size={14}>{tr('رقم الشحنة: ', 'Shipment no.: ')}{o.carrier_tracking}</T>
              )
            ) : (
              <T size={12.5} color={C.muted}>{tr('بنرسل لك رابط تتبّع الشحنة أول ما نسلّمها', "We'll send the tracking link once it's shipped")}</T>
            )}
          </View>
        ) : null}

        <View style={{ paddingHorizontal: 22, paddingTop: 24 }}>
          <T latin w="medium" size={12} spacing={2.2} style={{ marginBottom: 6 }}>{tr('ITEMS · القطع', 'ITEMS')}</T>
          {o.items.map((i, k) => (
            <Pressable key={k} disabled={!i.photo_url} onPress={() => i.photo_url && setGallery([{ url: i.photo_url, caption: i.name }])}
              style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line }}>
              <Photo path={i.photo_url} label={i.brand ?? ''} style={{ width: 52, height: 64 }} />
              <View style={{ flex: 1 }}>
                {i.brand ? <BrandText size={11.5}>{i.brand}</BrandText> : null}
                <T size={13} color={C.sub}>{i.name}</T>
                {i.details ? <T size={12} color={C.muted}>{i.details}</T> : null}
              </View>
              <T latin size={13}>{omrReal(i.price)}</T>
            </Pressable>
          ))}
          <View style={{ gap: 6, paddingTop: 14 }}>
            {o.delivery_fee > 0 ? <SummaryRow label={tr('التوصيل', 'Delivery')} value={omrReal(o.delivery_fee)} /> : null}
            {(o.tax ?? 0) > 0 ? <SummaryRow label={tr('الضريبة', 'Tax')} value={omrReal(o.tax)} /> : null}
            {(o.discount ?? 0) > 0 ? <SummaryRow label={o.discount_label || tr('خصم', 'Discount')} value={`-${omrReal(o.discount)}`} color={C.green} /> : null}
            <SummaryRow label={tr('الإجمالي', 'Total')} value={omrReal(o.total)} strong />
            {o.paid > 0 ? <SummaryRow label={tr('المدفوع', 'Paid')} value={omrReal(o.paid)} /> : null}
            {o.remaining > 0
              ? <SummaryRow label={tr('المتبقي', 'Balance')} value={omrReal(o.remaining)} color={C.red} strong />
              : <SummaryRow label={tr('مدفوع بالكامل', 'Paid in full')} value="✓" color={C.green} />}
          </View>
          {o.pay_url && o.remaining > 0 ? (
            <View style={{ gap: 6, paddingTop: 14 }}>
              <Btn icon="card" label={tr(`ادفع الآن · ${omrReal(o.remaining)}`, `Pay now · ${omrReal(o.remaining)}`)} onPress={() => pay(o.pay_url as string)} />
              <T size={11.5} color={C.muted} center>{f.wallet.on && loggedIn ? tr('رصيدك أو بطاقة أو Apple Pay · دفع آمن عبر أموال', 'Your balance, card or Apple Pay · secure payment via Amwal') : tr('بطاقة أو Apple Pay · دفع آمن عبر أموال', 'Card or Apple Pay · secure payment via Amwal')}</T>
            </View>
          ) : null}
        </View>

        {o.gift && f.gifts.on ? (
          <View style={{ marginHorizontal: 22, marginTop: 24, padding: 14, backgroundColor: C.cream, gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="gift" size={18} color={C.gold} stroke={1.3} />
              <T size={14} w="medium">{tr('هدية 🎁', 'Gift 🎁')}</T>
            </View>
            {o.gift.to ? <T size={13} color={C.sub}>{tr(`إلى ${o.gift.to}`, `To ${o.gift.to}`)}{o.gift.phone ? ` · ` : ''}{o.gift.phone ? <T latin size={13} color={C.sub}>{o.gift.phone}</T> : null}</T> : null}
            {o.gift.message ? <T size={13} color={C.ink} w="light">«{o.gift.message}»</T> : null}
            {o.gift.wrap || o.gift.hide_prices ? (
              <T size={12} color={C.muted}>{[o.gift.wrap ? tr('تغليف هدية', 'Gift wrapped') : '', o.gift.hide_prices ? tr('بدون أسعار في الطرد', 'No prices in the parcel') : ''].filter(Boolean).join(' · ')}</T>
            ) : null}
          </View>
        ) : null}

        {f.chat.on && loggedIn ? (
          <Pressable onPress={() => router.push({ pathname: '/chat', params: { ps_order_id: String(o.id), invoice_no: o.invoice_no } })}
            style={{ marginHorizontal: 22, marginTop: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, backgroundColor: C.ink }}>
            <Icon name="chat" size={18} color={C.white} stroke={1.5} />
            <T size={14} color={C.white}>{tr('اسأل عن طلبك', 'Ask about your order')}</T>
          </Pressable>
        ) : null}

        {companyWa ? (
          <Pressable onPress={() => Linking.openURL(`https://wa.me/${companyWa}?text=${encodeURIComponent(tr(`مرحبا، بخصوص طلبي ${o.invoice_no}`, `Hi, about my order ${o.invoice_no}`))}`)}
            style={{ margin: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderWidth: 1, borderColor: C.lineStrong }}>
            <Icon name="whatsapp" size={18} stroke={1.5} />
            <T size={14}>{tr('تواصل معنا بخصوص الطلب', 'Ask us about this order')}</T>
          </Pressable>
        ) : null}
      </ScrollView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, padding: 16, paddingBottom: Math.max(insets.bottom, 16), backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.line }}>
        <Btn style={{ flex: 1 }} height={50} icon="doc" label={tr('الفاتورة', 'Invoice')} onPress={() => setInvoice(true)} />
        {receipts.length ? (
          <Btn style={{ flex: 1 }} height={50} kind="outline" icon="receipt" label={tr(`إيصال البوتيك (${receipts.length})`, `Boutique receipt (${receipts.length})`)} onPress={() => setGallery(receipts)} />
        ) : null}
      </View>

      {/* Photos / receipts */}
      <Modal visible={!!gallery} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setGallery(null)}>
        <View style={{ flex: 1, backgroundColor: C.white, direction: isAr ? 'rtl' : 'ltr' }}>
          <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: C.line }}>
            <Pressable onPress={() => setGallery(null)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={tr('إغلاق', 'Close')}><Icon name="close" size={20} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: S.gutter, gap: 18 }}>
            {(gallery ?? []).map((g, k) => (
              <View key={k} style={{ gap: 8 }}>
                <Image source={{ uri: g.url }} style={{ width: W - S.gutter * 2, height: (W - S.gutter * 2) * 1.3 }} contentFit="contain" />
                <T size={12.5} color={C.muted}>{g.caption}</T>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Invoice */}
      <Modal visible={invoice} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setInvoice(false)}>
        <View style={{ flex: 1, backgroundColor: C.white, direction: isAr ? 'rtl' : 'ltr' }}>
          <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: C.line }}>
            <Pressable onPress={() => setInvoice(false)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={tr('إغلاق', 'Close')}><Icon name="close" size={20} /></Pressable>
            <T size={16} w="medium" center style={{ flex: 1 }}>{tr('الفاتورة', 'Invoice')}</T>
            <View style={{ width: 44 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 24, gap: 16, paddingBottom: 60 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 2, borderBottomColor: C.maroon, paddingBottom: 14 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <T size={15} w="semibold">{company?.name || 'GH Shopper'}</T>
                {company?.cr_number ? <T size={11.5} color={C.muted}>{tr(`السجل التجاري ${company.cr_number}`, `CR ${company.cr_number}`)}</T> : null}
                {company?.tax_number ? <T size={11.5} color={C.muted}>{tr(`الرقم الضريبي ${company.tax_number}`, `Tax no. ${company.tax_number}`)}</T> : null}
                {company?.phone ? <T latin size={11.5} color={C.muted}>{company.phone}</T> : null}
              </View>
              <View>
                <T size={22} w="semibold" color={C.maroon}>{tr('فاتورة', 'Invoice')}</T>
                <T latin size={11} spacing={3} color={C.gold}>INVOICE</T>
              </View>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
              <View><T size={11} color={C.muted}>{tr('العميل', 'Customer')}</T><T size={13} w="medium">{customer?.name ?? ''}</T></View>
              <View><T size={11} color={C.muted}>{tr('رقم الفاتورة', 'Invoice no.')}</T><T latin size={13}>{o.invoice_no}</T></View>
              <View><T size={11} color={C.muted}>{tr('التاريخ', 'Date')}</T><T size={13}>{dateText(o.created_at, isAr)}</T></View>
            </View>
            <Divider />
            {o.items.map((i, k) => (
              <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  {i.brand ? <BrandText size={11}>{i.brand}</BrandText> : null}
                  <T size={13}>{i.name}</T>
                </View>
                <T latin size={13}>{omrReal(i.price)}</T>
              </View>
            ))}
            <Divider />
            <SummaryRow label={tr('مجموع القطع', 'Subtotal')} value={omrReal(o.items_total)} />
            {o.delivery_fee > 0 ? <SummaryRow label={tr('التوصيل', 'Delivery')} value={omrReal(o.delivery_fee)} /> : null}
            {(o.tax ?? 0) > 0 ? <SummaryRow label={tr('الضريبة', 'Tax')} value={omrReal(o.tax)} /> : null}
            {(o.discount ?? 0) > 0 ? <SummaryRow label={o.discount_label || tr('خصم', 'Discount')} value={`-${omrReal(o.discount)}`} color={C.green} /> : null}
            <SummaryRow label={tr('الإجمالي', 'Total')} value={omrReal(o.total)} strong />
            {o.payments.map((p, k) => <SummaryRow key={k} label={`${tr('دفعة', 'Payment')} ${p.paid_on ?? ''}`} value={omrReal(p.amount)} />)}
            <View style={{ backgroundColor: C.maroon, padding: 12, flexDirection: 'row', justifyContent: 'space-between' }}>
              <T size={14} w="medium" color={C.white}>{tr('المتبقي', 'Balance due')}</T>
              <T latin size={14} color={C.white}>{omrReal(o.remaining)}</T>
            </View>
            {company?.bank_details && o.remaining > 0 ? <T size={12} color={C.muted}>{company.bank_details}</T> : null}
            {company?.invoice_note ? <T size={12} color={C.muted}>{company.invoice_note}</T> : null}
            <T size={14} w="medium" color={C.maroon} center>{tr('شكراً لثقتكم', 'Thank you for your trust')}</T>
            {cachedOrders()?.portal_url ? (
              <Btn kind="outline" icon="share" label={tr('حفظ أو طباعة PDF', 'Save or print as PDF')} onPress={() => WebBrowser.openBrowserAsync(cachedOrders()?.portal_url as string)} />
            ) : null}
            <T size={11} color={C.faint} center>{SITE_BASE.replace('https://', '')}</T>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
