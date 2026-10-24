import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type ThemeMode, useAppearance } from '@/appearance';
import { useAuth } from '@/auth';
import { num, omrReal, waNumber } from '@/format';
import { Icon, type IconName } from '@/icons';
import { useLang } from '@/lang';
import { pushEnabled, setPushEnabled } from '@/push';
import { C, S } from '@/theme';
import { Btn, Row, T } from '@/ui';
import { FLAG, gccConfig, OMAN, setCountryCode } from '@/region';
import { useWishlist } from '@/wishlist';
import { LinearGradient } from 'expo-linear-gradient';
import { tierLook } from '@/tier-look';
import { useFeatures } from '@/features';
import { VipProgress } from '@/vip';
import { walletBalance } from '@/wallet';

const COMPANY_WA = '96877246972';
const INSTAGRAM = 'https://instagram.com/shopper.gh';
const CARD = '#350304'; // the brand maroon, same in light and dark
const CARD_GOLD = '#D6B08C';

function Tile({ icon, label, note, onPress }: { icon: IconName; label: string; note?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      style={({ pressed }) => ({ width: '50%', height: 104, borderEndWidth: 1, borderBottomWidth: 1, borderColor: C.line, padding: 16, justifyContent: 'space-between', backgroundColor: pressed ? C.surface2 : C.bg })}>
      <Icon name={icon} size={23} stroke={1.25} />
      <View>
        <T size={14} w="medium" lines={1}>{label}</T>
        {note ? <T size={11.5} color={C.muted} lines={1}>{note}</T> : null}
      </View>
    </Pressable>
  );
}

function Section({ title }: { title: string }) {
  return <T size={12} color={C.muted} style={{ paddingHorizontal: S.gutter, marginTop: 30, marginBottom: 2 }}>{title}</T>;
}

export default function Account() {
  const insets = useSafeAreaInsets();
  const { tr, isAr, setLang, country } = useLang();
  const { mode, setMode } = useAppearance();
  const { user, loggedIn, logout } = useAuth();
  const wish = useWishlist();
  const [push, setPush] = useState(true);
  const f = useFeatures();
  const [balance, setBalance] = useState<number | null>(null);
  useFocusEffect(useCallback(() => {
    if (loggedIn && f.wallet.on) walletBalance().then(setBalance).catch(() => undefined);
    else setBalance(null);
  }, [loggedIn, f.wallet.on]));

  useEffect(() => {
    pushEnabled().then(setPush).catch(() => undefined);
  }, []);

  const togglePush = async (on: boolean) => {
    setPush(on);
    if (!on) {
      await setPushEnabled(false);
      return;
    }
    if (!loggedIn) return;
    const ok = await setPushEnabled(true).catch(() => false);
    if (!ok) {
      Alert.alert(tr('الإشعارات مقفلة', 'Notifications are off'), tr('فعّل إشعارات GH Shopper من إعدادات الجهاز', 'Turn on GH Shopper notifications in your phone settings'), [
        { text: tr('لاحقاً', 'Later'), style: 'cancel' },
        { text: tr('الإعدادات', 'Settings'), onPress: () => Linking.openSettings() },
      ]);
    }
  };

  const themes: { key: ThemeMode; ar: string; en: string }[] = [
    { key: 'system', ar: 'حسب الجهاز', en: 'Use phone setting' },
    { key: 'light', ar: 'فاتح', en: 'Light' },
    { key: 'dark', ar: 'ليلي', en: 'Dark' },
  ];
  const themeLabel = themes.find((t) => t.key === mode) ?? themes[0];

  const points = num(user?.loyalty_points);
  const signIn = () => router.push('/login');

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 50 }}>
      <View style={{ paddingHorizontal: S.gutter }}>
        <T size={26} w="medium">{loggedIn && user ? tr(`أهلاً، ${user.name.split(' ')[0]}`, `Hi, ${user.name.split(' ')[0]}`) : tr('حسابي', 'Account')}</T>
      </View>

      {/* Member card */}
      {loggedIn && user ? (() => {
        const look = tierLook(user.loyalty_tier);
        return (
        <Pressable onPress={() => router.push('/loyalty')} accessibilityRole="button"
          style={{ marginHorizontal: S.gutter, marginTop: 16, minHeight: 176, overflow: 'hidden' }}>
          <LinearGradient colors={look.bg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 20, minHeight: 176, justifyContent: 'space-between' }}>
          <View style={{ position: 'absolute', top: 8, left: 8, right: 8, bottom: 8, borderWidth: 0.7, borderColor: look.line, opacity: 0.45 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <T latin size={11} spacing={3} color={look.soft}>{`GH MEMBER${user.loyalty_tier ? ` · ${user.loyalty_tier.toUpperCase()}` : ''}`}</T>
            <Icon name="crown" size={20} color={look.soft} stroke={1.2} />
          </View>
          <View style={{ gap: 2, marginTop: 18 }}>
            <T size={19} w="medium" color={look.ink} lines={1}>{user.name}</T>
            {user.email ? <T latin size={12.5} color={look.sub} lines={1} ltr>{user.email}</T> : null}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <T latin size={28} color={look.ink} lh={32}>{points.toLocaleString('en-US')}</T>
              <T size={12.5} color={look.sub}>{tr('نقطة', 'points')}</T>
            </View>
            <T size={12} color={look.soft} style={{ textDecorationLine: 'underline' }}>{tr('تفاصيل النقاط', 'Points details')}</T>
          </View>
          {/* progress to the next tier, inside the same card (vip_progress) */}
          <VipProgress look={look} />
          </LinearGradient>
        </Pressable>
        );
      })() : (
        <View style={{ marginHorizontal: S.gutter, marginTop: 16, padding: 22, backgroundColor: CARD, gap: 10 }}>
          <T latin size={11} spacing={3} color={CARD_GOLD}>GH MEMBER</T>
          <T size={18} w="medium" color={C.pure}>{tr('أهلاً بك في GH Shopper', 'Welcome to GH Shopper')}</T>
          <T size={13} color="rgba(255,255,255,0.75)">{tr('سجّل دخولك عشان تتابع طلباتك، تجمع النقاط، وتحفظ القطع اللي تعجبك.', 'Sign in to follow your orders, earn points and save what you love.')}</T>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
            <Pressable onPress={signIn} style={{ flex: 1, height: 46, backgroundColor: C.pure, alignItems: 'center', justifyContent: 'center' }}>
              <T size={14} color="#111111" center>{tr('تسجيل الدخول', 'Sign in')}</T>
            </Pressable>
            <Pressable onPress={() => router.push('/register')} style={{ flex: 1, height: 46, borderWidth: 1, borderColor: C.pure, alignItems: 'center', justifyContent: 'center' }}>
              <T size={14} color={C.pure} center>{tr('إنشاء حساب', 'Create account')}</T>
            </Pressable>
          </View>
        </View>
      )}

      {/* Shortcuts */}
      <View style={{ marginHorizontal: S.gutter, marginTop: 20, flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderStartWidth: 1, borderColor: C.line }}>
        <Tile icon="doc" label={tr('طلباتي', 'My orders')} note={loggedIn ? tr('الطلبات والفواتير', 'Orders & invoices') : tr('في هذا الجهاز', 'On this phone')} onPress={() => router.push('/orders')} />
        <Tile icon="heart" label={tr('المفضلة', 'Wishlist')} note={wish.products.length ? tr(`${wish.products.length} قطعة`, `${wish.products.length} pieces`) : undefined} onPress={() => (loggedIn ? router.push('/wishlist') : signIn())} />
        <Tile icon="pin" label={tr('عناويني', 'Addresses')} onPress={() => (loggedIn ? router.push('/addresses') : signIn())} />
        <Tile icon="user" label={tr('الملف الشخصي', 'Profile')} note={loggedIn ? tr('الاسم والبريد وكلمة المرور', 'Name, email, password') : undefined} onPress={() => (loggedIn ? router.push('/profile') : signIn())} />
        <Tile icon="crown" label={tr('نقاطي', 'My points')} note={loggedIn ? tr(`${points} نقطة`, `${points} points`) : undefined} onPress={() => (loggedIn ? router.push('/loyalty') : signIn())} />
        <Tile icon="gift" label={tr('ادعُ صديقك', 'Invite a friend')} note={tr('نقاط لك وله', 'Points for you both')} onPress={() => (loggedIn ? router.push('/invite') : signIn())} />
        <Tile icon="camera" label={tr('اطلب قطعة', 'Request a piece')} note={tr('نجيبها لك', 'We get it for you')} onPress={() => router.push('/request')} />
        {f.quotes.on ? (
          <Tile icon="tag" label={tr('طلباتي الخاصة', 'My piece requests')} note={tr('عروض الأسعار', 'Price quotes')} onPress={() => (loggedIn ? router.push('/requests') : signIn())} />
        ) : null}
        {f.wallet.on ? (
          <Tile icon="card" label={tr('رصيدك', 'My balance')} note={balance !== null ? omrReal(balance) : undefined} onPress={() => (loggedIn ? router.push('/wallet') : signIn())} />
        ) : null}
        {f.chat.on ? (
          <Tile icon="chat" label={tr('المحادثة', 'Chat')} note={tr('كلّم فريق GH', 'Talk to the GH team')} onPress={() => (loggedIn ? router.push('/chat') : signIn())} />
        ) : null}
        <Tile icon="truck" label={tr('تتبع طلب', 'Track an order')} note={tr('برقم الطلب', 'By order number')} onPress={() => router.push('/track')} />
        <Tile icon="bell" label={tr('الإشعارات', 'Notifications')} onPress={() => router.push('/notifications')} />
      </View>

      {/* Gift card */}
      <Pressable onPress={() => router.push('/gift-card')} accessibilityRole="button" style={{ marginHorizontal: S.gutter, marginTop: 16 }}>
        <LinearGradient colors={['#4A0709', CARD, '#1E0102']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 18, paddingHorizontal: 18 }}>
          <View style={{ position: 'absolute', top: 6, left: 6, right: 6, bottom: 6, borderWidth: 0.7, borderColor: CARD_GOLD, opacity: 0.4 }} />
          <Icon name="gift" size={26} color={CARD_GOLD} stroke={1.2} />
          <View style={{ flex: 1, gap: 2 }}>
            <T size={15} w="medium" color="#F6E9D8">{tr('أهدِ بطاقة هدية', 'Send a gift card')}</T>
            <T size={12} color="rgba(246,233,216,0.7)">{tr('توصل على جوال اللي تحبه مع رسالتك', 'Sent to their phone with your message')}</T>
          </View>
          <Icon name="forward" size={16} color={CARD_GOLD} flip={isAr} />
        </LinearGradient>
      </Pressable>

      <Section title={tr('الإعدادات', 'Settings')} />
      <View style={{ paddingHorizontal: S.gutter }}>
        <Row icon="globe" title={tr('اللغة', 'Language')} value={isAr ? 'العربية' : 'English'}
          onPress={() => Alert.alert(tr('اللغة', 'Language'), tr('بيعاد فتح التطبيق باللغة اللي تختارها', 'The app reopens in the language you choose'), [
            { text: 'العربية', onPress: () => setLang('ar') },
            { text: 'English', onPress: () => setLang('en') },
            { text: tr('إلغاء', 'Cancel'), style: 'cancel' },
          ])} />
        {gccConfig().enabled && gccConfig().countries.length ? (() => {
          const list = [{ code: 'OM', name_ar: OMAN.name_ar, name_en: OMAN.name_en, currency: 'OMR' }, ...gccConfig().countries];
          const cur = list.find((c) => c.code === country) ?? list[0];
          return (
            <Row icon="pin" title={tr('بلد التوصيل والعملة', 'Ship to & currency')} value={`${FLAG[cur.code] ?? ''} ${isAr ? cur.name_ar : cur.name_en} · ${cur.currency}`}
              onPress={() => Alert.alert(tr('بلد التوصيل', 'Ship to'), tr('الأسعار تظهر بعملة بلدك، والدفع بالريال العماني', 'Prices show in your currency; you pay in Omani rials'), [
                ...list.map((c) => ({ text: `${FLAG[c.code] ?? ''} ${isAr ? c.name_ar : c.name_en} · ${c.currency}`, onPress: () => setCountryCode(c.code) })),
                { text: tr('إلغاء', 'Cancel'), style: 'cancel' as const },
              ])} />
          );
        })() : null}
        <Row icon="moon" title={tr('المظهر', 'Appearance')} value={tr(themeLabel.ar, themeLabel.en)}
          onPress={() => Alert.alert(tr('المظهر', 'Appearance'), undefined, [
            ...themes.map((t) => ({ text: tr(t.ar, t.en), onPress: () => setMode(t.key) })),
            { text: tr('إلغاء', 'Cancel'), style: 'cancel' as const },
          ])} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 56, borderBottomWidth: 1, borderBottomColor: C.line }}>
          <Icon name="bell" size={21} stroke={1.3} />
          <View style={{ flex: 1 }}>
            <T size={15}>{tr('إشعارات الطلبات والعروض', 'Order & offer notifications')}</T>
            {!loggedIn ? <T size={12} color={C.muted}>{tr('تشتغل بعد تسجيل الدخول', 'Works once you sign in')}</T> : null}
          </View>
          <Switch value={push} onValueChange={togglePush} trackColor={{ true: C.ink, false: C.lineStrong }} thumbColor={C.white} ios_backgroundColor={C.lineStrong} />
        </View>
        {f.wishlist_alerts.on && loggedIn ? (
          <Row icon="heart" title={tr('تنبيهات المفضلة', 'Wishlist alerts')} subtitle={tr('نزول السعر، رجوع القطعة، جديد البراندات', 'Price drops, back in stock, new from brands')} onPress={() => router.push('/alert-prefs')} />
        ) : null}
      </View>

      <Section title={tr('المساعدة', 'Help')} />
      <View style={{ paddingHorizontal: S.gutter }}>
        {f.chat.on ? (
          <Row icon="chat" title={tr('المحادثة المباشرة', 'Live chat')} subtitle={tr('داخل التطبيق · فريق GH', 'In the app · the GH team')} onPress={() => (loggedIn ? router.push('/chat') : signIn())} />
        ) : null}
        <Row icon="whatsapp" title={tr('تحدث معنا', 'Chat with us')} subtitle={tr('واتساب · نرد عليك بسرعة', 'WhatsApp · we reply fast')} onPress={() => Linking.openURL(`https://wa.me/${waNumber(COMPANY_WA)}`)} />
        <Row icon="instagram" title={tr('تابعنا', 'Follow us')} value="@shopper.gh" onPress={() => Linking.openURL(INSTAGRAM)} />
        <Row icon="info" title={tr('الأسئلة الشائعة', 'FAQ')} onPress={() => router.push('/faq')} />
        <Row icon="info" title={tr('الشروط والسياسات', 'Terms & policies')} onPress={() => router.push('/policies')} />
        {loggedIn ? (
          <Row icon="logout" title={tr('تسجيل الخروج', 'Sign out')} danger chevron={false}
            onPress={() => Alert.alert(tr('تسجيل الخروج', 'Sign out'), tr('أكيد؟', 'Are you sure?'), [
              { text: tr('إلغاء', 'Cancel'), style: 'cancel' },
              { text: tr('خروج', 'Sign out'), style: 'destructive', onPress: () => logout() },
            ])} />
        ) : null}
      </View>

      {!loggedIn ? (
        <View style={{ paddingHorizontal: S.gutter, marginTop: 24 }}>
          <Btn kind="outline" height={46} label={tr('تسجيل الدخول', 'Sign in')} onPress={signIn} />
        </View>
      ) : null}
      <T size={11} color={C.faint} center style={{ marginTop: 30 }}>GH SPC · CR 1666587 · v2.0</T>
    </ScrollView>
  );
}
