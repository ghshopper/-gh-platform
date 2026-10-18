import { router } from 'expo-router';
import { Alert, Linking, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/auth';
import { num, waNumber } from '@/format';
import { useLang } from '@/lang';
import { C, S } from '@/theme';
import { Btn, Kicker, Row, T } from '@/ui';
import { useWishlist } from '@/wishlist';

const COMPANY_WA = '96877246972';

export default function Account() {
  const insets = useSafeAreaInsets();
  const { tr, isAr, setLang } = useLang();
  const { user, loggedIn, logout } = useAuth();
  const wish = useWishlist();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.white }} contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 40 }}>
      <View style={{ paddingHorizontal: S.gutter, gap: 4 }}>
        <T size={26} w="medium">{tr('حسابي', 'Account')}</T>
      </View>

      {loggedIn && user ? (
        <View style={{ marginHorizontal: S.gutter, marginTop: 16, padding: 20, backgroundColor: C.cream, gap: 4 }}>
          <Kicker color={C.gold}>GH MEMBER</Kicker>
          <T size={20} w="medium">{user.name}</T>
          {user.email ? <T latin size={12.5} color={C.sub}>{user.email}</T> : null}
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 10 }}>
            <T latin size={22}>{String(num(user.loyalty_points))}</T>
            <T size={12.5} color={C.sub}>{tr('نقطة ولاء', 'loyalty points')}</T>
          </View>
        </View>
      ) : (
        <View style={{ marginHorizontal: S.gutter, marginTop: 16, padding: 22, backgroundColor: C.cream, gap: 10 }}>
          <T size={17} w="medium">{tr('أهلاً بك في GH Shopper', 'Welcome to GH Shopper')}</T>
          <T size={13} color={C.sub}>{tr('سجّل دخولك عشان تتابع طلباتك، تجمع النقاط، وتحفظ القطع اللي تعجبك.', 'Sign in to follow your orders, earn points and save what you love.')}</T>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
            <Btn style={{ flex: 1 }} height={46} label={tr('تسجيل الدخول', 'Sign in')} onPress={() => router.push('/login')} />
            <Btn style={{ flex: 1 }} height={46} kind="outline" label={tr('إنشاء حساب', 'Create account')} onPress={() => router.push('/register')} />
          </View>
        </View>
      )}

      <View style={{ paddingHorizontal: S.gutter, marginTop: 18 }}>
        <Row icon="doc" title={tr('طلباتي', 'My orders')} subtitle={loggedIn ? tr('كل طلباتك مع الفواتير', 'All your orders and invoices') : tr('الطلبات المحفوظة في هذا الجهاز', 'Orders saved on this phone')} onPress={() => router.push('/orders')} />
        <Row icon="heart" title={tr('المفضلة', 'Wishlist')} value={wish.products.length ? String(wish.products.length) : undefined} onPress={() => router.push('/wishlist')} />
        {loggedIn ? <Row icon="pin" title={tr('عناويني', 'My addresses')} onPress={() => router.push('/addresses')} /> : null}
        {loggedIn ? <Row icon="crown" title={tr('برنامج الولاء', 'Loyalty program')} onPress={() => router.push('/loyalty')} /> : null}
        <Row icon="camera" title={tr('اطلب قطعة غير متوفرة', 'Request a piece')} subtitle={tr('أخبرنا بالقطعة وبنجيبها لك', 'Tell us the piece and we get it')} onPress={() => router.push('/request')} />
        <Row icon="search" title={tr('تتبع طلب برقمه', 'Track an order')} onPress={() => router.push('/track')} />
        <Row icon="bell" title={tr('الإشعارات', 'Notifications')} onPress={() => router.push('/notifications')} />
      </View>

      <View style={{ paddingHorizontal: S.gutter, marginTop: 26 }}>
        <T latin w="medium" size={12} spacing={2.2} style={{ marginBottom: 4 }}>{tr('SETTINGS · الإعدادات', 'SETTINGS')}</T>
        <Row icon="globe" title={tr('اللغة', 'Language')} value={isAr ? 'العربية' : 'English'}
          onPress={() => Alert.alert(tr('اللغة', 'Language'), undefined, [
            { text: 'العربية', onPress: () => setLang('ar') },
            { text: 'English', onPress: () => setLang('en') },
            { text: tr('إلغاء', 'Cancel'), style: 'cancel' },
          ])} />
        {loggedIn ? <Row icon="edit" title={tr('تعديل الحساب', 'Edit account')} onPress={() => router.push('/profile')} /> : null}
        <Row icon="info" title={tr('الشروط والسياسات', 'Terms & policies')} onPress={() => router.push('/policies')} />
        <Row icon="whatsapp" title={tr('تواصل معنا على واتساب', 'WhatsApp us')} onPress={() => Linking.openURL(`https://wa.me/${waNumber(COMPANY_WA)}`)} />
        <Row icon="share" title="Instagram · @shopper.gh" onPress={() => Linking.openURL('https://instagram.com/shopper.gh')} />
        {loggedIn ? (
          <Row icon="logout" title={tr('تسجيل الخروج', 'Sign out')} danger chevron={false}
            onPress={() => Alert.alert(tr('تسجيل الخروج', 'Sign out'), tr('أكيد؟', 'Are you sure?'), [
              { text: tr('إلغاء', 'Cancel'), style: 'cancel' },
              { text: tr('خروج', 'Sign out'), style: 'destructive', onPress: () => logout() },
            ])} />
        ) : null}
      </View>
      <T size={11} color={C.faint} center style={{ marginTop: 30 }}>GH SPC · CR 1666587 · v2.0</T>
    </ScrollView>
  );
}
