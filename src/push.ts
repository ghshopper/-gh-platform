import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp } from '@react-native-firebase/app';
import {
  AuthorizationStatus,
  deleteToken,
  getMessaging,
  getInitialNotification,
  getToken,
  onMessage,
  onNotificationOpenedApp,
  onTokenRefresh,
  registerDeviceForRemoteMessages,
  requestPermission,
  subscribeToTopic,
  unsubscribeFromTopic,
} from '@react-native-firebase/messaging';
import { Platform, PermissionsAndroid } from 'react-native';
import { api, hasToken } from './api';

let listening = false;
const OFF = 'push_off';

/** The switch in Account. Off = this phone's token is deleted, so nothing arrives. */
export async function pushEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(OFF).catch(() => null)) !== '1';
}

export async function setPushEnabled(on: boolean): Promise<boolean> {
  if (on) {
    await AsyncStorage.removeItem(OFF).catch(() => undefined);
    return registerPushToken();
  }
  await AsyncStorage.setItem(OFF, '1').catch(() => undefined);
  try {
    const m = getMessaging(getApp());
    for (const t of ['all_ar', 'all_en', 'all_users']) await unsubscribeFromTopic(m, t).catch(() => undefined);
    await deleteToken(m);
  } catch {
    // Nothing to delete.
  }
  return false;
}

async function appLang(): Promise<'ar' | 'en'> {
  return (await AsyncStorage.getItem('app_lang').catch(() => null)) === 'en' ? 'en' : 'ar';
}

/** Tell the server about this phone (guests too) and join the offers topic in the app's language. */
async function sendToken(fcm: string): Promise<void> {
  const lang = await appLang();
  const body = { token: fcm, platform: Platform.OS, lang };
  api.post('/customer/push-device', body).catch(() => undefined);
  if (hasToken()) api.put('/fcm-token', { fcm_token: fcm, platform: Platform.OS, lang }).catch(() => undefined);
  const messaging = getMessaging(getApp());
  const off = lang === 'en' ? 'all_ar' : 'all_en';
  await subscribeToTopic(messaging, `all_${lang}`).catch(() => undefined);
  await unsubscribeFromTopic(messaging, off).catch(() => undefined);
  // the older app listened on "all_users"; the server still sends there for it
  await unsubscribeFromTopic(messaging, 'all_users').catch(() => undefined);
}

/**
 * Ask for notification permission (signed in or not) and send the FCM token
 * to the server, so order updates and offers reach every phone.
 */
export async function registerPushToken(): Promise<boolean> {
  if (!(await pushEnabled())) return false;
  const messaging = getMessaging(getApp());
  if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  }
  const status = await requestPermission(messaging);
  const allowed = status === AuthorizationStatus.AUTHORIZED || status === AuthorizationStatus.PROVISIONAL;
  if (!allowed) return false;
  if (Platform.OS === 'ios') await registerDeviceForRemoteMessages(messaging);
  const fcm = await getToken(messaging);
  if (fcm) await sendToken(fcm);
  if (!listening) {
    listening = true;
    onTokenRefresh(messaging, (t) => {
      pushEnabled().then((on) => {
        if (on) sendToken(t).catch(() => undefined);
      });
    });
  }
  return true;
}

type Opened = (data: Record<string, string>) => void;
type Shown = (title: string, body: string, data: Record<string, string>) => void;

/**
 * Taps on a notification open the right screen; a notification arriving while
 * the app is open shows as a small bar (iOS shows no banner then).
 * Returns a function that stops listening.
 */
export function listenForPushes(onOpen: Opened, onForeground: Shown): () => void {
  try {
    const messaging = getMessaging(getApp());
    const asData = (d: unknown) => (d && typeof d === 'object' ? (d as Record<string, string>) : {});
    getInitialNotification(messaging)
      .then((m) => {
        if (m) onOpen(asData(m.data));
      })
      .catch(() => undefined);
    const offOpen = onNotificationOpenedApp(messaging, (m) => onOpen(asData(m.data)));
    const offMsg = onMessage(messaging, async (m) => {
      const title = m.notification?.title ?? '';
      const body = m.notification?.body ?? '';
      if (title || body || m.data) onForeground(title, body, asData(m.data));
    });
    return () => {
      offOpen();
      offMsg();
    };
  } catch {
    return () => undefined;
  }
}
