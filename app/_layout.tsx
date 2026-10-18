import { CormorantGaramond_400Regular_Italic } from '@expo-google-fonts/cormorant-garamond';
import {
  IBMPlexSansArabic_300Light,
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
} from '@expo-google-fonts/ibm-plex-sans-arabic';
import { Jost_400Regular, Jost_500Medium } from '@expo-google-fonts/jost';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppDataProvider } from '@/appdata';
import { AppearanceProvider, useAppearance } from '@/appearance';
import { AuthProvider, useAuth } from '@/auth';
import { CartProvider } from '@/cart';
import { LangProvider, useLang } from '@/lang';
import { QuickAddHost } from '@/product-card';
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

  return (
    // Arabic mirrors natively (see lang.tsx); `dir` is only a fallback.
    <View style={[{ flex: 1, backgroundColor: C.bg }, dir]}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'slide_from_right' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" options={{ presentation: 'modal' }} />
        <Stack.Screen name="register" options={{ presentation: 'modal' }} />
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
          <AuthProvider>
            <AppDataProvider>
              <WishlistProvider>
                <CartProvider>
                  <AppearanceProvider>
                    <Shell />
                  </AppearanceProvider>
                </CartProvider>
              </WishlistProvider>
            </AppDataProvider>
          </AuthProvider>
        </LangProvider>
      </SafeAreaProvider>
  );
}
