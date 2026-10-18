import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/icons';
import { useLang } from '@/lang';
import { C } from '@/theme';
import { Btn, Kicker, T } from '@/ui';

export default function OrderPlaced() {
  const { number, gift, paid } = useLocalSearchParams<{ number?: string; gift?: string; paid?: string }>();
  const insets = useSafeAreaInsets();
  const { tr } = useLang();
  return (
    <View style={{ flex: 1, backgroundColor: C.white, paddingTop: insets.top + 60, paddingHorizontal: 28, alignItems: 'center', gap: 14 }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, borderWidth: 1, borderColor: C.ink, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="check" size={34} stroke={1.4} />
      </View>
      <Kicker center>THANK YOU</Kicker>
      <T size={24} w="medium" center>{tr('تم استلام طلبك', 'Your order is in')}</T>
      {number ? <T latin size={15} spacing={1.5} center>{number}</T> : null}
      <T size={14} color={C.sub} center>
        {paid ? tr('تم الدفع بنجاح. ', 'Payment received. ') : ''}
        {gift ? tr(`بنجهّز هديتك لـ ${gift} بتغليف فاخر.`, `We'll gift-wrap it for ${gift}.`) : tr('طلبك قيد التجهيز الآن، شكراً لثقتك.', "We're preparing your order. Thank you.")}
      </T>
      <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 20 }}>
        <Btn label={tr('طلباتي', 'My orders')} onPress={() => router.replace('/orders')} />
        <Btn kind="outline" label={tr('متابعة التسوق', 'Continue shopping')} onPress={() => router.replace('/')} />
      </View>
    </View>
  );
}
