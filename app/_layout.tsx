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
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppDataProvider } from '@/appdata';
import { AuthProvider, useAuth } from '@/auth';
import { CartProvider } from '@/cart';
import { LangProvider, useLang } from '@/lang';
import { BrandSplash } from '@/splash';
import { C } from '@/theme';
import { WishlistProvider } from '@/wishlist';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function Shell() {
  const { isAr } = useLang();
  const { ready } = useAuth();
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  return (
    // The whole app mirrors with the language (native RTL is off on purpose).
    <View style={{ flex: 1, direction: isAr ? 'rtl' : 'ltr', backgroundColor: C.bg }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'slide_from_right' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" options={{ presentation: 'modal' }} />
        <Stack.Screen name="register" options={{ presentation: 'modal' }} />
      </Stack>
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <LangProvider>
          <AuthProvider>
            <AppDataProvider>
              <WishlistProvider>
                <CartProvider>
                  <Shell />
                </CartProvider>
              </WishlistProvider>
            </AppDataProvider>
          </AuthProvider>
        </LangProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
