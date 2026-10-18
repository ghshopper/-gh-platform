import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp } from '@react-native-firebase/app';
import {
  AuthorizationStatus,
  deleteToken,
  getMessaging,
  getToken,
  onTokenRefresh,
  registerDeviceForRemoteMessages,
  requestPermission,
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
    await deleteToken(getMessaging(getApp()));
  } catch {
    // Nothing to delete.
  }
  return false;
}

/**
 * Ask for notification permission and send the FCM token to the server
 * (same /fcm-token endpoint and Firebase project as the previous app).
 */
export async function registerPushToken(): Promise<boolean> {
  if (!hasToken() || !(await pushEnabled())) return false;
  const messaging = getMessaging(getApp());
  if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  }
  const status = await requestPermission(messaging);
  const allowed = status === AuthorizationStatus.AUTHORIZED || status === AuthorizationStatus.PROVISIONAL;
  if (!allowed) return false;
  if (Platform.OS === 'ios') await registerDeviceForRemoteMessages(messaging);
  const fcm = await getToken(messaging);
  if (fcm) await api.put('/fcm-token', { fcm_token: fcm });
  if (!listening) {
    listening = true;
    onTokenRefresh(messaging, (t) => {
      pushEnabled().then((on) => {
        if (on && hasToken()) api.put('/fcm-token', { fcm_token: t }).catch(() => undefined);
      });
    });
  }
  return true;
}
