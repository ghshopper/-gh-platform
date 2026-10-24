import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Switch, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, listOf } from '@/api';
import { useAppData } from '@/appdata';
import { useAuth } from '@/auth';
import { useCart } from '@/cart';
import { CouponBox } from '@/coupon-box';
import { useFeature } from '@/features';
import { num, omr, omrReal } from '@/format';
import { FLAG, gccConfig, gccCountry, gulfEta, OMAN, setCountryCode, showingOtherCurrency } from '@/region';
import { etaDates, etaForMany, withGulf, type Origin } from '@/eta';
import { rememberGuestOrder } from '@/guest';
import { Icon } from '@/icons';
import { useLang } from '@/lang';
import { pickedLocation, clearPickedLocation } from '@/location-store';
import { type Carrier, deliveryKey, GOVERNORATES } from '@/oman';
import { GENACOM_BRANCHES } from '@/genacom';
import { AMWAL_CODES, payWithAmwal } from '@/payment';
import { C, F, S } from '@/theme';
import { redeemGift, walletBalance } from '@/wallet';
import type { Address, PaymentGateway } from '@/types';
import { Btn, Check, Divider, Field, Header, Segments, SummaryRow, T } from '@/ui';

function Section({ title, children }: { title: string; children: ReactNode }) {
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
  const { tr, isAr, pick, country } = useLang();
  // Gulf shipping: another country = Genacom/DHL to the door, fixed price, paid in OMR
  const gcc = gccConfig();
  const abroad = gccCountry(country);
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
  // Gift options (features §5): wrap (server's fee) and no prices on the invoice
  const giftsF = useFeature('gifts');
  const [giftWrap, setGiftWrap] = useState(false);
  const [hidePrices, setHidePrices] = useState(false);
  // رصيدك — the GH wallet (features §4)
  const walletF = useFeature('wallet');
  const [walletBal, setWalletBal] = useState(0);
  const [useWallet, setUseWallet] = useState(false);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [giftCode, setGiftCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [redeemErr, setRedeemErr] = useState<string | null>(null);
  // Delivery
  // Muscat & Barka: our driver or a Genacom office. Rest of Oman: Genacom door or office.
  const [zone, setZone] = useState<'local' | 'oman'>('local');
  const [mode, setMode] = useState<'door' | 'office'>('door');
  const [branchId, setBranchId] = useState<string | null>(null);
  const carrier: Carrier = zone === 'local' && mode === 'door' ? 'own' : 'genacom';
  const branch = mode === 'office';
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
      const list = listOf<PaymentGateway>(r);
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

  const walletOn = walletF.on && loggedIn;
  const loadWallet = useCallback(async () => {
    if (!walletOn) return setWalletBal(0);
    setWalletBal(await walletBalance());
  }, [walletOn]);
  useEffect(() => { loadWallet(); }, [loadWallet]);

  const redeem = async () => {
    if (!giftCode.trim()) return;
    setRedeeming(true);
    setRedeemErr(null);
    try {
      const r = await redeemGift(giftCode);
      setWalletBal(r.balance);
      setUseWallet(true);
      setGiftCode('');
      setRedeemOpen(false);
      Alert.alert(tr('تمت الإضافة 🤍', 'Added 🤍'), tr(`انضاف ${omrReal(r.added)} لرصيدك`, `${omrReal(r.added)} added to your balance`));
    } catch (e) {
      setRedeemErr(e instanceof Error ? e.message : tr('الكود غير صحيح أو مستخدم', 'Invalid or used code'));
    } finally {
      setRedeeming(false);
    }
  };

  // Pin chosen on the map screen.
  useFocusEffect(
    useCallback(() => {
      const p = pickedLocation();
      if (p) {
        setCoords(p);
        clearPickedLocation();
        fillFrom(p.lat, p.lng);
      }
    }, []),
  );

  // gateways for where it ships (no cash on delivery outside Oman)
  const shown = gateways.filter((g) => {
    const real = AMWAL_CODES.includes(g.code) ? 'amwalpay' : g.code;
    if (abroad && (real === 'cod' || real === 'cash')) return false;
    const allowed = gateways.find((x) => x.code === real)?.allowed_countries ?? [];
    return real === 'amwalpay' || !allowed.length || allowed.includes(abroad ? abroad.code : 'OM');
  });
  useEffect(() => {
    if (payment && !shown.some((g) => g.code === payment)) setPayment(shown[0]?.code ?? '');
  }, [country, gateways.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const pickCountry = (code: string) => {
    if (code === country) return;
    setCountryCode(code);
    setGov(code === 'OM' ? GOVERNORATES[0].ar : '');
    setCity('');
    setBranchId(null);
    setMode('door');
    setAddressId(code === 'OM' && saved.length ? (saved.find((a) => a.is_default) ?? saved[0]).id : 'new');
  };
  const minDigits = abroad ? abroad.digits : 8;
  // the number as the courier needs it: +966… abroad, the usual 8 digits in Oman
  const fullPhone = (p: string) => {
    if (!abroad) return p.trim();
    const d = p.replace(/[٠-٩]/g, (x) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(x))).replace(/\D/g, '').replace(/^00/, '');
    return d.startsWith(abroad.dial) ? `+${d}` : `+${abroad.dial}${d.replace(/^0/, '')}`;
  };
  const fee = abroad ? abroad.fee : carrier !== 'own' && branch ? app.delivery.branch_fee : app.delivery.home_fee;
  const service = app.serviceFee;
  const tax = (cart.subtotal * app.taxPercent) / 100;
  const realCode = AMWAL_CODES.includes(payment) ? 'amwalpay' : payment;
  const gw = gateways.find((g) => g.code === realCode);
  const extra = num(gw?.extra_fee);
  const gross = cart.subtotal + fee + service + tax + extra;
  const couponValue = cart.coupon ? Math.min(cart.coupon.discount, gross) : 0;
  const before = gross - couponValue;
  const loyaltyValue = useLoyalty ? Math.min(loyalty.balance * loyalty.rate, before) : 0;
  const wrapOn = giftsF.on && giftsF.wrap !== false;
  const wrapFee = gift && wrapOn && giftWrap ? num(giftsF.wrap_fee, 2) : 0;
  const total = Math.max(0, before - loyaltyValue) + wrapFee;
  // رصيدك: the full balance up to the total; only the rest goes to Amwal / the chosen method.
  const walletUse = walletOn && useWallet ? Math.round(Math.min(walletBal, total) * 1000) / 1000 : 0;
  const charge = Math.max(0, Math.round((total - walletUse) * 1000) / 1000);
  const allWallet = walletUse > 0 && charge <= 0.0005;

  const chosenAddress = abroad || addressId === 'new' ? null : saved.find((a) => a.id === addressId) ?? null;
  const branchOnly = !abroad && carrier !== 'own' && branch;
  const allBranches = app.delivery.branches?.length ? app.delivery.branches : GENACOM_BRANCHES;
  const branches = allBranches.filter((b) => (zone === 'local' ? b.local : !b.local));
  const pickedBranch = branchOnly ? allBranches.find((b) => b.id === branchId) ?? null : null;

  // Fill the address from a point on the map (Apple's / Google's reverse geocoding, no key needed).
  const fillFrom = async (lat: number, lng: number) => {
    try {
      const [r] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (!r) return;
      const region = `${r.region ?? ''} ${r.subregion ?? ''}`.toLowerCase();
      const g = GOVERNORATES.find((x) => region.includes(x.en.toLowerCase()) || region.includes(x.ar) || (x.en === 'Muscat' && /masqat|مسقط/.test(region)));
      if (g) setGov(g.ar);
      const town = r.city || r.subregion || '';
      if (town) setCity(town);
      const st = [r.district, r.street].filter((x) => x && x !== town).join('، ');
      if (st) setStreet(st);
      if (r.streetNumber) setBuilding(r.streetNumber);
      // Muscat and Barka: our own driver; the rest of Oman: Genacom.
      const where = `${region} ${town}`.toLowerCase();
      if (/muscat|masqat|مسقط|barka|بركاء|بركا/.test(where)) setZone('local');
      else if (g) setZone('oman');
    } catch {
      // the fields stay as they are; the pin is still saved
    }
  };

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
      await fillFrom(pos.coords.latitude, pos.coords.longitude);
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
    if (phone.replace(/\D/g, '').length < minDigits) e.phone = tr('رقم غير صحيح', 'Invalid number');
    if (abroad && !gov.trim()) e.district = tr('مطلوب', 'Required');
    if (abroad && !street.trim()) e.street = tr('مطلوب', 'Required');
    if (gift && !giftName.trim()) e.giftName = req;
    if (!chosenAddress && !branchOnly) {
      if (!city.trim()) e.city = req;
    }
    if (branchOnly && !pickedBranch) e.branch = tr('اختر مكتب جيناكم اللي بتستلم منه', 'Choose the Genacom office to pick up from');
    if (!payment) e.payment = tr('اختر طريقة الدفع', 'Choose a payment method');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const addressPayload = () => {
    if (abroad) {
      const label = `شحن خليجي لباب البيت (${abroad.name_ar})`;
      return {
        delivery_method: `gcc_${gcc.carrier || 'genacom'}`,
        delivery_label: label,
        country: abroad.name_ar,
        country_code: abroad.code,
        display_currency: abroad.currency,
        recipient_name: gift ? giftName.trim() : name.trim(),
        phone: fullPhone(gift && giftPhone.trim() ? giftPhone : phone),
        area: gov.trim(),
        city: city.trim(),
        street: street.trim(),
        building: building.trim(),
        postal_code: landmark.trim(),
        notes: label,
        text: [abroad.name_ar, city.trim(), gov.trim(), street.trim(), building.trim()].filter(Boolean).join('، '),
      };
    }
    const methodKey = deliveryKey(carrier, branch);
    const methodText =
      carrier === 'own' ? 'مندوب GH لباب البيت' : pickedBranch ? `جيناكم — استلام من مكتب ${pickedBranch.name}` : 'جيناكم — لباب البيت';
    const a = branchOnly ? null : chosenAddress;
    const parts = a
      ? [a.governorate, a.city, a.street, a.building, a.details].filter(Boolean)
      : [gov, city, street, building, landmark].filter(Boolean);
    return {
      delivery_method: methodKey,
      pickup_branch: pickedBranch?.id ?? null,
      delivery_label: methodText,
      recipient_name: gift ? giftName.trim() : a?.recipient_name ?? name.trim(),
      phone: gift && giftPhone.trim() ? giftPhone.trim() : a?.phone ?? phone.trim(),
      country: 'عُمان',
      area: pickedBranch ? pickedBranch.gov : a?.governorate ?? gov,
      city: pickedBranch ? pickedBranch.name : a?.city ?? city.trim(),
      street: a?.street ?? street.trim(),
      building: a?.building ?? building.trim(),
      notes: [methodText, a?.details ?? landmark.trim()].filter(Boolean).join(' · '),
      text: pickedBranch ? `مكتب جيناكم ${pickedBranch.name} — ${pickedBranch.where}` : parts.join('، '),
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
    let paidSure = false;
    let amwalTx = '';
    try {
      // The code's amount is checked again by the server; make sure it still
      // matches before any money moves.
      if (cart.coupon) {
        const fresh = await cart.recheckCoupon(phone.trim());
        if (!fresh || Math.abs(fresh.discount - cart.coupon.discount) > 0.0005) {
          Alert.alert(tr('تغيّر كود الخصم', 'Your discount changed'), tr('راجع الإجمالي الجديد ثم أكمل الطلب', 'Check the new total, then place the order'));
          return;
        }
      }
      if (allWallet) {
        paidSure = true;
      } else if (AMWAL_CODES.includes(payment)) {
        const wallet = payment === 'amwal_apple' || payment === 'amwal_google';
        const r = await payWithAmwal(charge, wallet, isAr);
        if (r.ok !== false) amwalTx = r.transactionId;
        const via = `أموال${wallet ? (Platform.OS === 'ios' ? ' (Apple Pay)' : ' (Google Pay)') : ''}`;
        if (r.ok === 'unknown') {
          // Amwal answered in a shape we could not read: keep the order so a
          // paid customer is never lost, and flag it for the shop to check.
          paidNote = `⚠️ تحقق من الدفع في لوحة أموال قبل التجهيز · ${via} · المعاملة ${r.transactionId}${r.reference ? ` · المرجع ${r.reference}` : ''}\nرد أموال: ${r.raw.slice(0, 600)}`;
        } else if (!r.ok) {
          Alert.alert(
            tr('لم تكتمل عملية الدفع', 'Payment not completed'),
            wallet ? tr('جرّب مرة ثانية أو ادفع بالبطاقة', 'Try again or pay by card') : tr('ما انخصم شي. حاول مرة ثانية.', 'Nothing was charged. Please try again.'),
          );
          return;
        } else {
          paidSure = true;
          paidNote = `مدفوع عبر ${via} · رقم العملية ${r.transactionId}${r.reference ? ` · المرجع ${r.reference}` : ''}`;
        }
      }
      const res = await api.post<{ data?: { id: number; order_number: string; guest_token?: string } }>('/customer/orders', {
        customer_name: name.trim(),
        customer_phone: fullPhone(phone),
        customer_email: email.trim() || null,
        is_gift: gift,
        gift_recipient_name: gift ? giftName.trim() : null,
        gift_message: gift
          ? (giftsF.on ? giftMessage.trim() : [giftMessage.trim(), giftPhone.trim() ? `هاتف المستلم: ${giftPhone.trim()}` : ''].filter(Boolean).join('\n')) || null
          : null,
        ...(giftsF.on && gift
          ? { gift_recipient_phone: giftPhone.trim() ? fullPhone(giftPhone) : null, gift_wrap: wrapFee > 0, gift_hide_prices: hidePrices }
          : {}),
        // رصيدك: the server takes min(this, balance, total) and checks Amwal against the rest.
        ...(walletUse > 0 ? { wallet_amount: Number(walletUse.toFixed(3)) } : {}),
        payment_method: realCode,
        subtotal: Number(cart.subtotal.toFixed(3)),
        shipping_cost: Number(fee.toFixed(3)),
        service_fee: Number(service.toFixed(3)),
        // Loyalty only: the server adds the code's discount itself.
        discount_amount: Number(loyaltyValue.toFixed(3)),
        coupon_code: cart.coupon?.code ?? null,
        // The server asks Amwal about this transaction before marking it paid.
        amwal_transaction_id: amwalTx || null,
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
      router.replace({ pathname: '/order-placed', params: { number: order?.order_number ?? '', gift: gift ? giftName : '', paid: paidSure ? '1' : '', bank: realCode === 'bank_transfer' ? '1' : '' } });
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
            <Field label={abroad ? tr(`رقم الهاتف (+${abroad.dial})`, `Phone (+${abroad.dial})`) : tr('رقم الهاتف', 'Phone')} value={phone} onChangeText={setPhone} error={errors.phone} keyboardType="phone-pad" ltr textContentType="telephoneNumber" />
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
                {giftsF.on ? (
                  <View>
                    {wrapOn ? (
                      <Check on={giftWrap} onPress={() => setGiftWrap(!giftWrap)}
                        label={tr(`تغليف هدية فاخر (+${omr(num(giftsF.wrap_fee, 2))})`, `Luxury gift wrap (+${omr(num(giftsF.wrap_fee, 2))})`)} />
                    ) : null}
                    <Check on={hidePrices} onPress={() => setHidePrices(!hidePrices)} label={tr('إخفاء الأسعار من الفاتورة والطرد', 'Hide prices on the invoice and parcel')} />
                  </View>
                ) : null}
              </View>
            ) : null}
          </Section>

          <Section title={tr('DELIVERY · التوصيل', 'DELIVERY')}>
            {gcc.enabled && gcc.countries.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {[{ code: 'OM', name_ar: OMAN.name_ar, name_en: OMAN.name_en }, ...gcc.countries].map((c) => {
                  const on = country === c.code;
                  return (
                    <Pressable key={c.code} onPress={() => pickCountry(c.code)} accessibilityRole="radio" accessibilityState={{ checked: on }}
                      style={{ paddingHorizontal: 14, height: 40, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: on ? C.ink : C.lineStrong, backgroundColor: on ? C.ink : C.white }}>
                      <T size={14}>{FLAG[c.code] ?? ''}</T>
                      <T size={13} color={on ? C.white : C.ink}>{isAr ? c.name_ar : c.name_en}</T>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}
            {abroad ? (
              <View style={{ gap: 14 }}>
                <Choice on onPress={() => undefined}
                  title={tr('شحن سريع لباب البيت', 'Express door delivery')}
                  sub={tr(`${gcc.eta?.min ?? 3}–${gcc.eta?.max ?? 5} أيام عمل بعد تجهيز طلبك`, `${gcc.eta?.min ?? 3}–${gcc.eta?.max ?? 5} working days after your order is ready`)}
                  right={omr(abroad.fee)} />
                <Field label={tr('المدينة', 'City')} value={city} onChangeText={setCity} error={errors.city} />
                <Field label={tr('المنطقة / الحي', 'District')} value={gov} onChangeText={setGov} error={errors.district} />
                <Field label={tr('الشارع', 'Street')} value={street} onChangeText={setStreet} error={errors.street} />
                <Field label={tr('رقم المبنى / الشقة', 'Building / apartment')} value={building} onChangeText={setBuilding} />
                <Field label={tr('الرمز البريدي أو العنوان الوطني (اختياري)', 'Postal code / national address (optional)')} value={landmark} onChangeText={setLandmark} ltr />
                {(isAr ? gcc.note_ar : gcc.note_en) ? (
                  <View style={{ padding: 12, backgroundColor: C.surface }}><T size={12.5} color={C.sub}>{isAr ? gcc.note_ar : gcc.note_en}</T></View>
                ) : null}
              </View>
            ) : (
              <>
            <Segments
              value={zone}
              onChange={(z) => { setZone(z); setBranchId(null); }}
              options={[
                { key: 'local', label: tr('مسقط أو بركاء', 'Muscat or Barka') },
                { key: 'oman', label: tr('باقي ولايات السلطنة', 'Rest of Oman') },
              ]}
            />
            <View style={{ gap: 8 }}>
              <Choice on={mode === 'door'} onPress={() => setMode('door')}
                title={zone === 'local' ? tr('مندوبنا لباب البيت', 'Our driver to your door') : tr('جيناكم لباب البيت', 'Genacom to your door')}
                sub={zone === 'local' ? tr('توصيل خاص من GH Shopper', 'Delivered by GH Shopper') : tr('شركة جيناكم توصل لعنوانك', 'Genacom delivers to your address')}
                right={omr(app.delivery.home_fee)} />
              <Choice on={mode === 'office'} onPress={() => setMode('office')}
                title={tr('استلام من مكتب جيناكم', 'Pick up from a Genacom office')}
                sub={tr('تختار المكتب الأقرب لك', 'Choose the office nearest you')}
                right={omr(app.delivery.branch_fee)} />
            </View>
            {branchOnly ? (
              <View style={{ gap: 8 }}>
                <T size={13} color={C.sub}>{tr('مكتب الاستلام', 'Pickup office')}</T>
                {Array.from(new Set(branches.map((b) => b.gov))).map((g) => (
                  <View key={g} style={{ gap: 6 }}>
                    {zone === 'oman' ? <T size={12} color={C.muted}>{g}</T> : null}
                    {branches.filter((b) => b.gov === g).map((b) => (
                      <Choice key={b.id} on={branchId === b.id} onPress={() => setBranchId(b.id)} title={b.name} sub={b.where} />
                    ))}
                  </View>
                ))}
                {errors.branch ? <T size={12} color={C.red}>{errors.branch}</T> : null}
              </View>
            ) : null}

            {!branchOnly && saved.length ? (
              <View style={{ gap: 8 }}>
                <T size={13} color={C.sub}>{tr('العنوان', 'Address')}</T>
                {saved.map((a) => (
                  <Choice key={a.id} on={addressId === a.id} onPress={() => setAddressId(a.id)} title={a.title || a.recipient_name}
                    sub={[a.governorate, a.city, a.street, a.building].filter(Boolean).join('، ')} />
                ))}
                <Choice on={addressId === 'new'} onPress={() => setAddressId('new')} title={tr('عنوان جديد', 'New address')} />
              </View>
            ) : null}

            {!branchOnly && addressId === 'new' ? (
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
              </>
            )}
          </Section>

          <Section title={tr('PAYMENT · الدفع', 'PAYMENT')}>
            {shown.length === 0 ? <T size={13} color={C.muted}>{tr('جاري تحميل طرق الدفع…', 'Loading payment methods…')}</T> : null}
            {shown.map((g) => (
              <Choice key={g.code} on={payment === g.code} onPress={() => setPayment(g.code)}
                title={g.code === 'amwalpay' ? tr('البطاقة البنكية', 'Debit / credit card') : g.name}
                sub={g.code === 'amwalpay' ? tr('Visa · Mastercard · عبر أموال', 'Visa · Mastercard · via Amwal') : g.subtitle ?? undefined}
                right={num(g.extra_fee) > 0 ? `+${omr(g.extra_fee)}` : undefined} />
            ))}
            {errors.payment ? <T size={12} color={C.red}>{errors.payment}</T> : null}
            {walletOn && walletBal > 0 ? (
              <View style={{ borderWidth: 1, borderColor: useWallet ? C.ink : C.line, padding: 14, gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Icon name="card" size={21} color={C.gold} stroke={1.3} />
                  <View style={{ flex: 1 }}>
                    <T size={14.5} w="medium">{tr('رصيدك', 'Your balance')}</T>
                    <T latin size={13} color={C.sub}>{omrReal(walletBal)}</T>
                  </View>
                  <T size={12.5} color={C.sub}>{tr('استخدم رصيدك', 'Use balance')}</T>
                  <Switch value={useWallet} onValueChange={setUseWallet} trackColor={{ true: C.ink, false: C.lineStrong }} accessibilityLabel={tr('استخدم رصيدك', 'Use your balance')} />
                </View>
                {useWallet ? (
                  <View style={{ gap: 4, paddingTop: 6, borderTopWidth: 1, borderTopColor: C.line }}>
                    <SummaryRow label={tr('ينخصم من رصيدك', 'Taken from your balance')} value={omrReal(walletUse)} color={C.green} />
                    <SummaryRow label={tr('الباقي للدفع', 'Left to pay')} value={omrReal(charge)} strong />
                  </View>
                ) : null}
                <Pressable onPress={() => { setRedeemErr(null); setRedeemOpen(true); }} hitSlop={8} accessibilityRole="button">
                  <T size={12.5} color={C.sub} style={{ textDecorationLine: 'underline' }}>{tr('عندك بطاقة هدية؟ حوّلها لرصيدك', 'Have a gift card? Add it to your balance')}</T>
                </Pressable>
              </View>
            ) : walletOn ? (
              <Pressable onPress={() => { setRedeemErr(null); setRedeemOpen(true); }} hitSlop={8} accessibilityRole="button">
                <T size={12.5} color={C.sub} style={{ textDecorationLine: 'underline' }}>{tr('عندك بطاقة هدية؟ حوّلها لرصيدك', 'Have a gift card? Add it to your balance')}</T>
              </Pressable>
            ) : null}
            {loyalty.balance > 0 ? (
              <Check on={useLoyalty} onPress={() => setUseLoyalty(!useLoyalty)}
                label={tr(`استخدم نقاط الولاء (${loyalty.balance} نقطة = ${omrReal(loyalty.balance * loyalty.rate)})`, `Use loyalty points (${loyalty.balance} = ${omrReal(loyalty.balance * loyalty.rate)})`)} />
            ) : null}
            <CouponBox />
            <Field label={tr('ملاحظات للطلب (اختياري)', 'Order notes (optional)')} value={notes} onChangeText={setNotes} multiline />
          </Section>

          <View style={{ paddingHorizontal: S.gutter, paddingTop: 26, gap: 6 }}>
            <Divider style={{ marginBottom: 10 }} />
            <SummaryRow label={tr(`القطع (${cart.count})`, `Items (${cart.count})`)} value={omr(cart.subtotal)} />
            <SummaryRow label={abroad ? tr(`الشحن إلى ${abroad.name_ar}`, `Shipping to ${abroad.name_en}`) : carrier === 'own' ? tr('التوصيل · مندوبنا', 'Delivery · our driver') : branch ? tr(`جيناكم · مكتب ${pickedBranch?.name ?? ''}`, `Genacom · ${pickedBranch?.name ?? 'office'}`) : tr('جيناكم · لباب البيت', 'Genacom · door')} value={omr(fee)} />
            {service > 0 ? <SummaryRow label={tr('رسوم الخدمة وتجهيز الهدايا', 'Service & gift wrapping')} value={omr(service)} /> : null}
            {tax > 0 ? <SummaryRow label={tr('الضريبة', 'Tax')} value={omr(tax)} /> : null}
            {extra > 0 ? <SummaryRow label={tr('رسوم الدفع', 'Payment fee')} value={omr(extra)} /> : null}
            {couponValue > 0 && cart.coupon ? <SummaryRow label={tr(`كود الخصم (${cart.coupon.code})`, `Discount (${cart.coupon.code})`)} value={`-${omr(couponValue)}`} color={C.green} /> : null}
            {loyaltyValue > 0 ? <SummaryRow label={tr('خصم الولاء', 'Loyalty discount')} value={`-${omr(loyaltyValue)}`} color={C.green} /> : null}
            {wrapFee > 0 ? <SummaryRow label={tr('تغليف الهدية', 'Gift wrap')} value={omr(wrapFee)} /> : null}
            <View style={{ height: 6 }} />
            <SummaryRow label={tr('الإجمالي', 'Total')} value={omr(total)} strong />
            {walletUse > 0 ? (
              <>
                <SummaryRow label={tr('من رصيدك', 'From your balance')} value={`-${omr(walletUse)}`} color={C.green} />
                <SummaryRow label={tr('الباقي للدفع', 'Left to pay')} value={omr(charge)} strong />
              </>
            ) : null}
            {(() => {
              const base = etaForMany(cart.items.map((i) => (i.origin ?? 'europe') as Origin), app.delivery.eta);
              const e = base ? withGulf(base, gulfEta()) : null;
              return e ? <T size={12.5} color={C.sub}>{tr('يوصلك تقريباً ', 'Arrives around ')}{etaDates(e, isAr)}</T> : null;
            })()}
            {showingOtherCurrency() ? (
              <T size={12} color={C.muted} style={{ marginTop: 4 }}>
                {tr(`المبلغ يُخصم بالريال العماني: ${omrReal(charge)}. الأسعار بعملتك تقريبية، وبنكك يحوّلها.`, `You will be charged ${omrReal(charge)} in Omani rials. Prices in your currency are approximate.`)}
              </T>
            ) : null}
            <Btn label={allWallet ? tr('تأكيد الطلب · من رصيدك', 'Place order · from your balance') : tr(`تأكيد ودفع ${omrReal(charge)}`, `Confirm & pay ${omrReal(charge)}`)} loading={busy} onPress={placeOrder} style={{ marginTop: 16, marginBottom: insets.bottom }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8 }}>
              <Icon name="lock" size={14} color={C.muted} />
              <T size={11.5} color={C.muted}>{tr('دفع آمن عبر أموال', 'Secure payment by Amwal')}</T>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* gift card → رصيدك */}
      <Modal visible={redeemOpen} transparent animationType="fade" onRequestClose={() => setRedeemOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: C.scrim }}>
          <View style={{ backgroundColor: C.bg, padding: 22, gap: 14, direction: isAr ? 'rtl' : 'ltr' }}>
            <T size={17} w="medium">{tr('حوّل بطاقة الهدية لرصيدك', 'Add a gift card to your balance')}</T>
            <T size={13} color={C.sub}>{tr('رصيد البطاقة كامل ينضاف لرصيدك.', "The card's whole balance is added to yours.")}</T>
            <TextInput value={giftCode} onChangeText={(v) => { setGiftCode(v.toUpperCase()); setRedeemErr(null); }} autoCapitalize="characters" autoCorrect={false}
              placeholder="GH-XXXX-XXXX" placeholderTextColor={C.muted}
              style={{ height: 48, paddingHorizontal: 12, borderWidth: 1, borderColor: redeemErr ? C.red : C.lineStrong, color: C.ink, textAlign: 'left', fontFamily: F.latin }} />
            {redeemErr ? <T size={12.5} color={C.red}>{redeemErr}</T> : null}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Btn style={{ flex: 1 }} height={46} label={tr('حوّلها لرصيدك', 'Add to balance')} loading={redeeming} disabled={!giftCode.trim()} onPress={redeem} />
              <Btn style={{ flex: 1 }} height={46} kind="outline" label={tr('إلغاء', 'Cancel')} onPress={() => setRedeemOpen(false)} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
