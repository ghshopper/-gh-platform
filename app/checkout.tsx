import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, listOf } from '@/api';
import { useAppData } from '@/appdata';
import { useAuth } from '@/auth';
import { useCart } from '@/cart';
import { num, omr } from '@/format';
import { rememberGuestOrder } from '@/guest';
import { Icon } from '@/icons';
import { useLang } from '@/lang';
import { pickedLocation, clearPickedLocation } from '@/location-store';
import { type Carrier, deliveryKey, GOVERNORATES } from '@/oman';
import { AMWAL_CODES, payWithAmwal } from '@/payment';
import { C, S } from '@/theme';
import type { Address, PaymentGateway } from '@/types';
import { Btn, Check, Divider, Field, Header, Segments, SummaryRow, T } from '@/ui';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ paddingHorizontal: S.gutter, paddingTop: 26, gap: 14 }}>
      <T latin w="medium" size={12} spacing={2.2}>{title}</T>
      {children}
    </View>
  );
}

function Choice({ title, sub, on, onPress, right }: { title: string; sub?: string; on: boolean; onPress: () => void; right?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: on }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1, borderColor: on ? C.ink : C.line }}>
      <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: on ? C.ink : C.lineStrong, alignItems: 'center', justifyContent: 'center' }}>
        {on ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.ink }} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <T size={14.5} w="medium">{title}</T>
        {sub ? <T size={12} color={C.muted}>{sub}</T> : null}
      </View>
      {right ? <T latin size={13}>{right}</T> : null}
    </Pressable>
  );
}

export default function Checkout() {
  const insets = useSafeAreaInsets();
  const { tr, isAr, pick } = useLang();
  const { user, loggedIn } = useAuth();
  const cart = useCart();
  const app = useAppData();

  // Contact
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  // Gift
  const [gift, setGift] = useState(false);
  const [giftName, setGiftName] = useState('');
  const [giftPhone, setGiftPhone] = useState('');
  const [giftMessage, setGiftMessage] = useState('');
  // Delivery
  const [carrier, setCarrier] = useState<Carrier>('own');
  const [branch, setBranch] = useState(false);
  const [saved, setSaved] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState<number | 'new'>('new');
  const [gov, setGov] = useState(GOVERNORATES[0].ar);
  const [city, setCity] = useState('');
  const [street, setStreet] = useState('');
  const [building, setBuilding] = useState('');
  const [landmark, setLandmark] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  // Payment
  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [payment, setPayment] = useState<string>('');
  const [loyalty, setLoyalty] = useState({ balance: 0, rate: 0.01 });
  const [useLoyalty, setUseLoyalty] = useState(false);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user) {
      setName((v) => v || user.name || '');
      setPhone((v) => v || user.phone || '');
      setEmail((v) => v || user.email || '');
    }
  }, [user]);

  useEffect(() => {
    api.get<unknown>('/customer/payment-gateways').then((r) => {
      const list = listOf<PaymentGateway>(r).filter((g) => !g.allowed_countries?.length || g.allowed_countries.includes('OM'));
      // One Amwal gateway shows as two choices: card, and Apple Pay / Google Pay.
      const expanded: PaymentGateway[] = [];
      for (const g of list) {
        expanded.push(g);
        if (g.code === 'amwalpay') expanded.push({ ...g, code: Platform.OS === 'ios' ? 'amwal_apple' : 'amwal_google', name: Platform.OS === 'ios' ? 'Apple Pay' : 'Google Pay', subtitle: null });
      }
      setGateways(expanded);
      setPayment((p) => p || (expanded.find((g) => g.code === 'amwal_apple' || g.code === 'amwal_google') ?? expanded[0])?.code || '');
    }).catch(() => undefined);
    if (loggedIn) {
      api.get<unknown>('/customer/addresses').then((r) => {
        const list = listOf<Address>(r);
        setSaved(list);
        const def = list.find((a) => a.is_default) ?? list[0];
        if (def) setAddressId(def.id);
      }).catch(() => undefined);
      api.get<{ balance?: number | string; conversion_rate?: number | string }>('/customer/loyalty/balance')
        .then((r) => setLoyalty({ balance: num(r?.balance), rate: num(r?.conversion_rate, 0.01) || 0.01 }))
        .catch(() => undefined);
    }
  }, [loggedIn]);

  // Pin chosen on the map screen.
  useFocusEffect(
    useCallback(() => {
      const p = pickedLocation();
      if (p) {
        setCoords(p);
        clearPickedLocation();
      }
    }, []),
  );

  const fee = carrier !== 'own' && branch ? app.delivery.branch_fee : app.delivery.home_fee;
  const service = app.serviceFee;
  const tax = (cart.subtotal * app.taxPercent) / 100;
  const realCode = AMWAL_CODES.includes(payment) ? 'amwalpay' : payment;
  const gw = gateways.find((g) => g.code === realCode);
  const extra = num(gw?.extra_fee);
  const before = cart.subtotal + fee + service + tax + extra;
  const loyaltyValue = useLoyalty ? Math.min(loyalty.balance * loyalty.rate, before) : 0;
  const total = Math.max(0, before - loyaltyValue);

  const chosenAddress = addressId === 'new' ? null : saved.find((a) => a.id === addressId) ?? null;
  const branchOnly = carrier !== 'own' && branch;

  const locate = async () => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert(tr('الموقع', 'Location'), tr('اسمح للتطبيق بالوصول لموقعك من الإعدادات', 'Allow location access in Settings'));
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      Alert.alert(tr('ما قدرنا نحدد موقعك', 'Could not get your location'));
    } finally {
      setLocating(false);
    }
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    const req = tr('مطلوب', 'Required');
    if (!name.trim()) e.name = req;
    if (phone.replace(/\D/g, '').length < 8) e.phone = tr('رقم غير صحيح', 'Invalid number');
    if (gift && !giftName.trim()) e.giftName = req;
    if (!chosenAddress && !branchOnly) {
      if (!city.trim()) e.city = req;
    }
    if (!chosenAddress && branchOnly && !city.trim()) e.city = tr('اكتب الولاية عشان نحدد الفرع', 'Enter your wilayat so we pick the branch');
    if (!payment) e.payment = tr('اختر طريقة الدفع', 'Choose a payment method');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const addressPayload = () => {
    const methodKey = deliveryKey(carrier, branch);
    const methodText =
      carrier === 'own' ? 'مندوب GH لباب البيت' : `${carrier === 'nool' ? 'نول' : 'جيناكم'} — ${branch ? 'استلام من الفرع' : 'لباب البيت'}`;
    const a = chosenAddress;
    const parts = a
      ? [a.governorate, a.city, a.street, a.building, a.details].filter(Boolean)
      : [gov, city, street, building, landmark].filter(Boolean);
    return {
      delivery_method: methodKey,
      delivery_label: methodText,
      recipient_name: gift ? giftName.trim() : a?.recipient_name ?? name.trim(),
      phone: gift && giftPhone.trim() ? giftPhone.trim() : a?.phone ?? phone.trim(),
      country: 'عُمان',
      area: a?.governorate ?? gov,
      city: a?.city ?? city.trim(),
      street: a?.street ?? street.trim(),
      building: a?.building ?? building.trim(),
      notes: [methodText, a?.details ?? landmark.trim()].filter(Boolean).join(' · '),
      text: parts.join('، '),
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      latitude: coords?.lat ?? null,
      longitude: coords?.lng ?? null,
    };
  };

  const placeOrder = async () => {
    if (busy || !cart.items.length) return;
    if (!validate()) {
      Alert.alert(tr('أكمل البيانات', 'Complete the details'), tr('في حقول ناقصة', 'Some fields are missing'));
      return;
    }
    setBusy(true);
    let paidNote = '';
    try {
      if (AMWAL_CODES.includes(payment)) {
        const wallet = payment === 'amwal_apple' || payment === 'amwal_google';
        const r = await payWithAmwal(total, wallet, isAr);
        if (!r.ok) {
          Alert.alert(
            tr('لم تكتمل عملية الدفع', 'Payment not completed'),
            wallet ? tr('جرّب مرة ثانية أو ادفع بالبطاقة', 'Try again or pay by card') : tr('ما انخصم شي. حاول مرة ثانية.', 'Nothing was charged. Please try again.'),
          );
          return;
        }
        paidNote = `مدفوع عبر أموال${wallet ? (Platform.OS === 'ios' ? ' (Apple Pay)' : ' (Google Pay)') : ''} · رقم العملية ${r.transactionId}`;
      }
      const res = await api.post<{ data?: { id: number; order_number: string; guest_token?: string } }>('/customer/orders', {
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        customer_email: email.trim() || null,
        is_gift: gift,
        gift_recipient_name: gift ? giftName.trim() : null,
        gift_message: gift ? [giftMessage.trim(), giftPhone.trim() ? `هاتف المستلم: ${giftPhone.trim()}` : ''].filter(Boolean).join('\n') || null : null,
        payment_method: realCode,
        subtotal: Number(cart.subtotal.toFixed(3)),
        shipping_cost: Number(fee.toFixed(3)),
        service_fee: Number(service.toFixed(3)),
        discount_amount: Number(loyaltyValue.toFixed(3)),
        tax_amount: Number(tax.toFixed(3)),
        total_amount: Number(total.toFixed(3)),
        notes: [paidNote, notes.trim()].filter(Boolean).join('\n') || null,
        shipping_address: addressPayload(),
        items: cart.items.map((i) => ({
          product_id: i.productId,
          name: i.options.length ? `${i.name} — ${i.options.map((o) => `${o.label}: ${o.value}`).join('، ')}` : i.name,
          image: i.image,
          quantity: i.quantity,
          price: i.price,
        })),
      });
      const order = res?.data;
      if (order?.guest_token) await rememberGuestOrder(order.guest_token).catch(() => undefined);
      cart.clear();
      router.replace({ pathname: '/order-placed', params: { number: order?.order_number ?? '', gift: gift ? giftName : '', paid: paidNote ? '1' : '' } });
    } catch (e) {
      Alert.alert(
        tr('ما قدرنا نرسل الطلب', 'Could not place the order'),
        `${e instanceof Error ? e.message : ''}${paidNote ? `\n${tr('تم الدفع — تواصل معنا على واتساب وبنثبت طلبك.', 'You were charged — message us on WhatsApp and we will confirm your order.')}` : ''}`,
      );
    } finally {
      setBusy(false);
    }
  };

  if (!cart.items.length) {
    return (
      <View style={{ flex: 1, backgroundColor: C.white }}>
        <Header title={tr('إتمام الطلب', 'Checkout')} />
        <T size={15} center style={{ marginTop: 60 }}>{tr('السلة فارغة', 'Your bag is empty')}</T>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.white }}>
      <Header latinTitle={`CHECKOUT · ${tr('إتمام الطلب', 'CHECKOUT')}`} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {!loggedIn ? (
            <Pressable onPress={() => router.push('/login')} style={{ margin: S.gutter, marginBottom: 0, padding: 14, backgroundColor: C.surface2, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Icon name="user" size={18} />
              <T size={13} style={{ flex: 1 }}>{tr('سجّل دخولك عشان تتابع طلباتك وتجمع نقاط', 'Sign in to follow your orders and earn points')}</T>
              <Icon name="forward" size={14} color={C.faint} flip={isAr} />
            </Pressable>
          ) : null}

          <Section title={tr('CONTACT · بياناتك', 'CONTACT')}>
            <Field label={tr('الاسم الكامل', 'Full name')} value={name} onChangeText={setName} error={errors.name} textContentType="name" />
            <Field label={tr('رقم الهاتف', 'Phone')} value={phone} onChangeText={setPhone} error={errors.phone} keyboardType="phone-pad" ltr textContentType="telephoneNumber" />
            <Field label={tr('البريد الإلكتروني (اختياري)', 'Email (optional)')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" ltr />
          </Section>

          <Section title={tr('GIFT · هدية', 'GIFT')}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Icon name="gift" size={22} color={C.gold} stroke={1.3} />
              <View style={{ flex: 1 }}>
                <T size={14.5} w="medium">{tr('إرسال كهدية', 'Send as a gift')}</T>
                <T size={12} color={C.muted}>{tr('اجعل يوم شخص آخر مميزاً', "Make someone's day")}</T>
              </View>
              <Switch value={gift} onValueChange={setGift} trackColor={{ true: C.ink, false: C.lineStrong }} />
            </View>
            {gift ? (
              <View style={{ gap: 14 }}>
                <Field label={tr('اسم المستلم', 'Recipient name')} value={giftName} onChangeText={setGiftName} error={errors.giftName} />
                <Field label={tr('رقم هاتف المستلم (للتوصيل)', 'Recipient phone (for delivery)')} value={giftPhone} onChangeText={setGiftPhone} keyboardType="phone-pad" ltr />
                <Field label={tr('رسالة الإهداء (اختياري)', 'Gift message (optional)')} value={giftMessage} onChangeText={setGiftMessage} multiline />
              </View>
            ) : null}
          </Section>

          <Section title={tr('DELIVERY · التوصيل', 'DELIVERY')}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {([['own', tr('مندوبنا', 'Our driver'), tr('مسقط · لبابك', 'Muscat · door')], ['nool', tr('نول', 'Nool'), tr('كل عُمان', 'All Oman')], ['genacom', tr('جيناكم', 'Genacom'), tr('كل عُمان', 'All Oman')]] as const).map(([k, t, d]) => {
                const on = carrier === k;
                return (
                  <Pressable key={k} onPress={() => { setCarrier(k); if (k === 'own') setBranch(false); }} accessibilityRole="radio" accessibilityState={{ checked: on }}
                    style={{ flex: 1, height: 64, borderWidth: 1, borderColor: on ? C.ink : '#E2E2E2', backgroundColor: on ? C.white : '#FAFAFA', alignItems: 'center', justifyContent: 'center' }}>
                    <T size={13.5} w="medium" center>{t}</T>
                    <T size={11} color={C.muted} center>{d}</T>
                  </Pressable>
                );
              })}
            </View>
            {carrier !== 'own' ? (
              <Segments
                value={branch ? 'branch' : 'door'}
                onChange={(k) => setBranch(k === 'branch')}
                options={[
                  { key: 'door', label: tr(`لباب البيت · ${app.delivery.home_fee} ر.ع.`, `To your door · OMR ${app.delivery.home_fee}`) },
                  { key: 'branch', label: tr(`من الفرع · ${app.delivery.branch_fee} ر.ع.`, `Branch pickup · OMR ${app.delivery.branch_fee}`) },
                ]}
              />
            ) : (
              <T size={12.5} color={C.sub}>{tr(`مندوبنا يوصل لباب البيت داخل مسقط · ${app.delivery.home_fee} ر.ع.`, `Our driver delivers to your door in Muscat · OMR ${app.delivery.home_fee}`)}</T>
            )}

            {saved.length ? (
              <View style={{ gap: 8 }}>
                <T size={13} color={C.sub}>{tr('العنوان', 'Address')}</T>
                {saved.map((a) => (
                  <Choice key={a.id} on={addressId === a.id} onPress={() => setAddressId(a.id)} title={a.title || a.recipient_name}
                    sub={[a.governorate, a.city, a.street, a.building].filter(Boolean).join('، ')} />
                ))}
                <Choice on={addressId === 'new'} onPress={() => setAddressId('new')} title={tr('عنوان جديد', 'New address')} />
              </View>
            ) : null}

            {addressId === 'new' ? (
              <View style={{ gap: 14 }}>
                <View style={{ gap: 8 }}>
                  <T size={12.5} color={C.sub}>{tr('المحافظة', 'Governorate')}</T>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {GOVERNORATES.map((g) => (
                      <Pressable key={g.ar} onPress={() => setGov(g.ar)} style={{ paddingHorizontal: 14, height: 38, justifyContent: 'center', borderWidth: 1, borderColor: gov === g.ar ? C.ink : C.lineStrong, backgroundColor: gov === g.ar ? C.ink : C.white }}>
                        <T size={13} color={gov === g.ar ? C.white : C.ink}>{isAr ? g.ar : g.en}</T>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
                <Field label={tr('الولاية / المدينة', 'Wilayat / city')} value={city} onChangeText={setCity} error={errors.city} />
                {!branchOnly ? (
                  <>
                    <Field label={tr('اسم الشارع / الحي', 'Street / area')} value={street} onChangeText={setStreet} />
                    <Field label={tr('رقم المبنى / المنزل', 'Building / house no.')} value={building} onChangeText={setBuilding} />
                    <Field label={tr('علامة مميزة (اختياري)', 'Landmark (optional)')} value={landmark} onChangeText={setLandmark} />
                  </>
                ) : null}
              </View>
            ) : null}

            {!branchOnly ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable onPress={locate} style={{ flex: 1, height: 46, borderWidth: 1, borderColor: C.lineStrong, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {locating ? <ActivityIndicator color={C.ink} /> : <Icon name="locate" size={18} />}
                  <T size={13}>{tr('موقعي الحالي', 'My location')}</T>
                </Pressable>
                <Pressable onPress={() => router.push({ pathname: '/location', params: coords ? { lat: String(coords.lat), lng: String(coords.lng) } : {} })}
                  style={{ flex: 1, height: 46, borderWidth: 1, borderColor: C.lineStrong, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Icon name="pin" size={18} />
                  <T size={13}>{tr('حدد على الخريطة', 'Pick on map')}</T>
                </Pressable>
              </View>
            ) : null}
            {coords && !branchOnly ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon name="check" size={16} color={C.green} stroke={2} />
                <T size={12.5} color={C.green}>{tr('تم تحديد الموقع على الخريطة', 'Location pinned')}</T>
              </View>
            ) : null}
          </Section>

          <Section title={tr('PAYMENT · الدفع', 'PAYMENT')}>
            {gateways.length === 0 ? <T size={13} color={C.muted}>{tr('جاري تحميل طرق الدفع…', 'Loading payment methods…')}</T> : null}
            {gateways.map((g) => (
              <Choice key={g.code} on={payment === g.code} onPress={() => setPayment(g.code)}
                title={g.code === 'amwalpay' ? tr('البطاقة البنكية', 'Debit / credit card') : g.name}
                sub={g.code === 'amwalpay' ? tr('Visa · Mastercard · عبر أموال', 'Visa · Mastercard · via Amwal') : g.subtitle ?? undefined}
                right={num(g.extra_fee) > 0 ? `+${omr(g.extra_fee)}` : undefined} />
            ))}
            {errors.payment ? <T size={12} color={C.red}>{errors.payment}</T> : null}
            {loyalty.balance > 0 ? (
              <Check on={useLoyalty} onPress={() => setUseLoyalty(!useLoyalty)}
                label={tr(`استخدم نقاط الولاء (${loyalty.balance} نقطة = ${omr(loyalty.balance * loyalty.rate)})`, `Use loyalty points (${loyalty.balance} = ${omr(loyalty.balance * loyalty.rate)})`)} />
            ) : null}
            <Field label={tr('ملاحظات للطلب (اختياري)', 'Order notes (optional)')} value={notes} onChangeText={setNotes} multiline />
          </Section>

          <View style={{ paddingHorizontal: S.gutter, paddingTop: 26, gap: 6 }}>
            <Divider style={{ marginBottom: 10 }} />
            <SummaryRow label={tr(`القطع (${cart.count})`, `Items (${cart.count})`)} value={omr(cart.subtotal)} />
            <SummaryRow label={carrier === 'own' ? tr('التوصيل · مندوبنا', 'Delivery · our driver') : `${carrier === 'nool' ? tr('نول', 'Nool') : tr('جيناكم', 'Genacom')} · ${branch ? tr('من الفرع', 'branch') : tr('لباب البيت', 'door')}`} value={omr(fee)} />
            {service > 0 ? <SummaryRow label={tr('رسوم الخدمة وتجهيز الهدايا', 'Service & gift wrapping')} value={omr(service)} /> : null}
            {tax > 0 ? <SummaryRow label={tr('الضريبة', 'Tax')} value={omr(tax)} /> : null}
            {extra > 0 ? <SummaryRow label={tr('رسوم الدفع', 'Payment fee')} value={omr(extra)} /> : null}
            {loyaltyValue > 0 ? <SummaryRow label={tr('خصم الولاء', 'Loyalty discount')} value={`-${omr(loyaltyValue)}`} color={C.green} /> : null}
            <View style={{ height: 6 }} />
            <SummaryRow label={tr('الإجمالي', 'Total')} value={omr(total)} strong />
            <Btn label={tr(`تأكيد ودفع ${omr(total)}`, `Confirm & pay ${omr(total)}`)} loading={busy} onPress={placeOrder} style={{ marginTop: 16, marginBottom: insets.bottom }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8 }}>
              <Icon name="lock" size={14} color={C.muted} />
              <T size={11.5} color={C.muted}>{tr('دفع آمن عبر أموال', 'Secure payment by Amwal')}</T>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
