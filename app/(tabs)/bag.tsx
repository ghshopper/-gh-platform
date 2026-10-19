import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppData } from '@/appdata';
import { useCart } from '@/cart';
import { CouponBox } from '@/coupon-box';
import { omr } from '@/format';
import { etaDates, etaForMany, type Origin } from '@/eta';
import { Icon } from '@/icons';
import { useLang } from '@/lang';
import { C, S } from '@/theme';
import { BrandText, Btn, Empty, Photo, SummaryRow, T } from '@/ui';

export default function Bag() {
  const insets = useSafeAreaInsets();
  const { tr, isAr } = useLang();
  const cart = useCart();
  const app = useAppData();
  const service = cart.items.length ? app.serviceFee : 0;
  const tax = (cart.subtotal * app.taxPercent) / 100;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top }}>
      <View style={{ height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: C.line }}>
        <T latin w="medium" size={13} spacing={3} center>{`BAG · ${tr('السلة', 'BAG')}${cart.count ? ` (${cart.count})` : ''}`}</T>
        {cart.items.length ? (
          <Pressable
            style={{ position: 'absolute', end: 16 }}
            hitSlop={10}
            onPress={() =>
              Alert.alert(tr('إفراغ السلة', 'Empty bag'), tr('أكيد تبي تفرغ السلة؟', 'Remove everything from your bag?'), [
                { text: tr('إلغاء', 'Cancel'), style: 'cancel' },
                { text: tr('إفراغ', 'Empty'), style: 'destructive', onPress: cart.clear },
              ])
            }
          >
            <T size={12.5} color={C.sub}>{tr('إفراغ', 'Clear')}</T>
          </Pressable>
        ) : null}
      </View>

      {cart.items.length === 0 ? (
        <Empty icon="bag" title={tr('السلة فارغة', 'Your bag is empty')} text={tr('تصفح المنتجات وأضف ما يعجبك', 'Browse and add what you love')} action={tr('تسوّق الآن', 'Shop now')} onAction={() => router.navigate('/')} />
      ) : (
        <>
          <ScrollView contentContainerStyle={{ paddingHorizontal: S.gutter, paddingBottom: 260 }}>
            {cart.items.map((i) => (
              <View key={i.key} style={{ flexDirection: 'row', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.line }}>
                <Pressable onPress={() => router.push({ pathname: '/product/[id]', params: { id: String(i.productId) } })}>
                  <Photo path={i.image} label={i.brand} style={{ width: 80, height: 100 }} />
                </Pressable>
                <View style={{ flex: 1, gap: 2 }}>
                  {i.brand ? <BrandText size={12}>{i.brand}</BrandText> : null}
                  <T size={13.5} color={C.sub} w="light" lines={2}>{i.name}</T>
                  {i.options.map((o) => <T key={o.label} size={12} color={C.muted}>{`${o.label}: ${o.value}`}</T>)}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.line }}>
                      <Pressable onPress={() => cart.setQuantity(i.key, i.quantity - 1)} style={{ width: 34, height: 32, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={tr('إنقاص', 'Decrease')}>
                        <Icon name="minus" size={14} />
                      </Pressable>
                      <T latin size={13} center style={{ minWidth: 24 }}>{String(i.quantity)}</T>
                      <Pressable onPress={() => cart.setQuantity(i.key, i.quantity + 1)} style={{ width: 34, height: 32, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={tr('زيادة', 'Increase')}>
                        <Icon name="plus" size={14} />
                      </Pressable>
                    </View>
                    <T latin size={13.5}>{omr(i.price * i.quantity)}</T>
                  </View>
                </View>
                <Pressable onPress={() => cart.remove(i.key)} hitSlop={6} style={{ width: 32, alignItems: 'center' }} accessibilityLabel={tr('إزالة', 'Remove')}>
                  <Icon name="trash" size={16} color={C.faint} stroke={1.5} />
                </Pressable>
              </View>
            ))}
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 18 }}>
              <Icon name="gift" size={18} color={C.gold} stroke={1.3} />
              <T size={12.5} color={C.sub} style={{ flex: 1 }}>{tr('تقدر ترسلها هدية في الخطوة الجاية، مع رسالة الإهداء', 'You can send it as a gift with a message in the next step')}</T>
            </View>
            <View style={{ marginTop: 18, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.line }}>
              <CouponBox />
            </View>
          </ScrollView>

          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.line, padding: S.gutter, paddingTop: 14, gap: 6 }}>
            <SummaryRow label={tr('المجموع الفرعي', 'Subtotal')} value={omr(cart.subtotal)} />
            {service > 0 ? <SummaryRow label={tr('رسوم الخدمة وتجهيز الهدايا', 'Service & gift wrapping')} value={omr(service)} /> : null}
            {tax > 0 ? <SummaryRow label={tr(`الضريبة (${app.taxPercent}٪)`, `Tax (${app.taxPercent}%)`)} value={omr(tax)} /> : null}
            {cart.coupon ? <SummaryRow label={tr(`كود الخصم (${cart.coupon.code})`, `Discount (${cart.coupon.code})`)} value={`-${omr(cart.coupon.discount)}`} color={C.green} /> : null}
            {(() => {
              const e = etaForMany(cart.items.map((i) => (i.origin ?? 'europe') as Origin), app.delivery.eta);
              return e ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icon name="truck" size={16} color={C.sub} />
                  <T size={12.5} color={C.sub}>{tr('يوصلك تقريباً ', 'Arrives around ')}{etaDates(e, isAr)}</T>
                </View>
              ) : null;
            })()}
            <T size={12} color={C.muted}>{tr('التوصيل يتحدد في الخطوة الجاية', 'Delivery is set in the next step')}</T>
            <Btn label={tr('إتمام الطلب', 'Checkout')} onPress={() => router.push('/checkout')} style={{ marginTop: 8 }} />
          </View>
        </>
      )}
    </View>
  );
}
