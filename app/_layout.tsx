import { CormorantGaramond_400Regular_Italic } from '@expo-google-fonts/cormorant-garamond';
import {
  IBMPlexSansArabic_300Light,
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
} from '@expo-google-fonts/ibm-plex-sans-arabic';
import { Jost_400Regular, Jost_500Medium } from '@expo-google-fonts/jost';
import { useFonts } from 'expo-font';
import { router, Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as WebBrowser from 'expo-web-browser';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppDataProvider } from '@/appdata';
import { GenderProvider } from '@/gender';
import { AppearanceProvider, useAppearance } from '@/appearance';
import { AuthProvider, useAuth } from '@/auth';
import { CartProvider, useCart } from '@/cart';
import { setTrackedCart, trackScreen } from '@/track';
import { LangProvider, useLang } from '@/lang';
import { QuickAddHost, showToast } from '@/product-card';
import { listenForPushes, registerPushToken } from '@/push';
import { chatOpen, pokeChat } from '@/chat-poke';
import { openFeatureTarget } from '@/feature-links';
import { FeaturesProvider } from '@/features';
import { BrandSplash } from '@/splash';
import { C } from '@/theme';
import { WishlistProvider } from '@/wishlist';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function Shell() {
  const { dir } = useLang();
  const { dark } = useAppearance();
  const { ready } = useAuth();
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  // Tapping a notification opens what it is about.
  useEffect(() => {
    if (!ready) return;
    return listenForPushes(
      (data) => {
        const t = data.type ?? '';
        // new feature pushes first (purchase_photo etc. also carry an order_id)
        if (openFeatureTarget(t, data)) return;
        if (data.product_id) router.push({ pathname: '/product/[id]', params: data.review ? { id: data.product_id, review: '1' } : { id: data.product_id } });
        else if (data.brand_id) router.push({ pathname: '/brand/[id]', params: { id: data.brand_id } });
        else if (data.category_id) router.push({ pathname: '/products', params: { category_id: data.category_id } });
        else if (data.url) WebBrowser.openBrowserAsync(data.url).catch(() => undefined);
        else if (data.order_id || t.startsWith('order')) router.push('/orders');
        else router.push('/notifications');
      },
      (title, body, data) => {
        if (data?.type === 'chat') {
          pokeChat();
          if (chatOpen()) return; // the open chat shows it already
        }
        if (title || body) showToast([title, body].filter(Boolean).join(' · '), false);
      },
    );
  }, [ready]);

  // Screen views for the dashboard's live visitors and statistics.
  const pathname = usePathname();
  const cart = useCart();
  useEffect(() => { setTrackedCart(cart.count); }, [cart.count]);
  useEffect(() => { if (ready) trackScreen(pathname); }, [pathname, ready]);

  // After the splash, every phone (signed in or not) is asked once for notifications.
  useEffect(() => {
    if (!ready || !splashDone) return;
    const t = setTimeout(() => registerPushToken().catch(() => undefined), 1200);
    return () => clearTimeout(t);
  }, [ready, splashDone]);

  return (
    // Arabic mirrors natively (see lang.tsx); `dir` is only a fallback.
    <View style={[{ flex: 1, backgroundColor: C.bg }, dir]}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'slide_from_right' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" options={{ presentation: 'modal' }} />
        <Stack.Screen name="forgot-password" options={{ presentation: 'modal' }} />
        <Stack.Screen name="register" options={{ presentation: 'modal' }} />
        <Stack.Screen name="phone-code" options={{ presentation: 'modal' }} />
        <Stack.Screen name="service-review" options={{ presentation: 'modal' }} />
      </Stack>
      <QuickAddHost />
      {ready && !splashDone ? <BrandSplash onDone={() => setSplashDone(true)} /> : null}
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    IBMPlexSansArabic_300Light,
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_500Medium,
    IBMPlexSansArabic_600SemiBold,
    Jost_400Regular,
    Jost_500Medium,
    CormorantGaramond_400Regular_Italic,
  });
  if (!fontsLoaded) return null;
  return (
      <SafeAreaProvider>
        <LangProvider>
          <FeaturesProvider>
          <AuthProvider>
            <AppDataProvider>
              <GenderProvider>
              <WishlistProvider>
                <CartProvider>
                  <AppearanceProvider>
                    <Shell />
                  </AppearanceProvider>
                </CartProvider>
              </WishlistProvider>
              </GenderProvider>
            </AppDataProvider>
          </AuthProvider>
          </FeaturesProvider>
        </LangProvider>
      </SafeAreaProvider>
  );
}
