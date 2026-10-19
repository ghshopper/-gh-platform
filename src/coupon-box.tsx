import { useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { useCart } from './cart';
import { omr } from './format';
import { Icon } from './icons';
import { useLang } from './lang';
import { C, F } from './theme';
import { T } from './ui';

const EN: Record<string, string> = {
  'اكتب كود الخصم': 'Enter a discount code',
  'كود الخصم غير صالح': 'This code is not valid',
  'كود الخصم ما بدأ للحين': 'This code has not started yet',
  'كود الخصم منتهي': 'This code has expired',
  'كود الخصم وصل حد الاستخدام': 'This code has been fully used',
  'استخدمت هذا الكود من قبل': 'You have already used this code',
};

function english(msg: string): string {
  if (EN[msg]) return EN[msg];
  if (msg.includes('الحد الأدنى')) return 'Your bag is below the minimum for this code';
  if (msg.includes('لا ينطبق') || msg.includes('ما ينطبق')) return 'This code does not apply to the pieces in your bag';
  return msg;
}

/** Gift card codes look like GH-ABCD-1234. */
const isGiftCode = (c?: string | null) => /^GH-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(c ?? '');

/** "Have a discount code?" / "Use a gift card" — in the bag and at checkout. */
export function CouponBox() {
  const { tr, isAr } = useLang();
  const cart = useCart();
  // which box is open: a discount code or a gift card
  const [open, setOpen] = useState<false | 'code' | 'gift'>(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const say = (m: string) => (isAr ? m : english(m));

  if (cart.coupon) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: C.green, borderStyle: 'dashed' }}>
        <Icon name={isGiftCode(cart.coupon.code) ? 'gift' : 'tag'} size={18} color={C.green} stroke={1.5} />
        <View style={{ flex: 1 }}>
          {isGiftCode(cart.coupon.code) ? <T size={12} color={C.green}>{tr('بطاقة هدية', 'Gift card')}</T> : null}
          <T latin w="medium" size={13} spacing={1.2} color={C.green}>{cart.coupon.code}</T>
          <T size={12} color={C.sub}>{tr(`وفّرت ${omr(cart.coupon.discount)}`, `You save ${omr(cart.coupon.discount)}`)}</T>
        </View>
        <Pressable onPress={cart.removeCoupon} hitSlop={10} accessibilityLabel={tr('إزالة الكود', 'Remove code')}>
          <T size={12.5} color={C.sub} style={{ textDecorationLine: 'underline' }}>{tr('إزالة', 'Remove')}</T>
        </Pressable>
      </View>
    );
  }

  const apply = async () => {
    if (!code.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await cart.applyCoupon(code);
      setCode('');
      setOpen(false);
    } catch (e) {
      setError(say(e instanceof Error ? e.message : 'كود الخصم غير صالح'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 8 }}>
      {cart.couponNote ? <T size={12} color={C.red}>{say(cart.couponNote)}</T> : null}
      {!open ? (
        <>
          <Pressable onPress={() => setOpen('code')} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 }} accessibilityRole="button">
            <Icon name="tag" size={18} stroke={1.4} />
            <T size={13.5} style={{ flex: 1 }}>{tr('عندك كود خصم؟', 'Have a discount code?')}</T>
            <Icon name="plus" size={16} color={C.muted} />
          </Pressable>
          <Pressable onPress={() => setOpen('gift')} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, borderTopWidth: 1, borderTopColor: C.line }} accessibilityRole="button">
            <Icon name="gift" size={18} stroke={1.4} />
            <T size={13.5} style={{ flex: 1 }}>{tr('استخدم بطاقة هدية', 'Use a gift card')}</T>
            <Icon name="plus" size={16} color={C.muted} />
          </Pressable>
        </>
      ) : (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1, height: 46, borderWidth: 1, borderColor: error ? C.red : C.lineStrong, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 }}>
            <Icon name={open === 'gift' ? 'gift' : 'tag'} size={16} color={C.muted} />
            <TextInput
              value={code}
              onChangeText={(t) => { setCode(t.replace(/\s/g, '').toUpperCase()); setError(null); }}
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={apply}
              placeholder={open === 'gift' ? tr('رقم بطاقة الهدية (GH-XXXX-XXXX)', 'Gift card code (GH-XXXX-XXXX)') : tr('كود الخصم', 'Discount code')}
              placeholderTextColor={C.faint}
              style={{ flex: 1, height: '100%', fontFamily: code ? F.latinMedium : F.regular, fontSize: 14, letterSpacing: code ? 1.2 : 0, color: C.ink }}
            />
          </View>
          <Pressable onPress={apply} disabled={busy || !code.trim()} style={{ height: 46, paddingHorizontal: 18, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center', opacity: !code.trim() ? 0.45 : 1 }}>
            {busy ? <ActivityIndicator color={C.white} /> : <T size={13.5} color={C.white}>{tr('تطبيق', 'Apply')}</T>}
          </Pressable>
        </View>
      )}
      {error ? <T size={12} color={C.red}>{error}</T> : null}
    </View>
  );
}
