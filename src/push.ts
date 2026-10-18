import { getApp } from '@react-native-firebase/app';
import {
  AuthorizationStatus,
  getMessaging,
  getToken,
  onTokenRefresh,
  registerDeviceForRemoteMessages,
  requestPermission,
} from '@react-native-firebase/messaging';
import { Platform, PermissionsAndroid } from 'react-native';
import { api, hasToken } from './api';

let listening = false;

/**
 * Ask for notification permission and send the FCM token to the server
 * (same /fcm-token endpoint and Firebase project as the previous app).
 */
export async function registerPushToken(): Promise<void> {
  if (!hasToken()) return;
  const messaging = getMessaging(getApp());
  if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  }
  const status = await requestPermission(messaging);
  const allowed = status === AuthorizationStatus.AUTHORIZED || status === AuthorizationStatus.PROVISIONAL;
  if (!allowed) return;
  if (Platform.OS === 'ios') await registerDeviceForRemoteMessages(messaging);
  const fcm = await getToken(messaging);
  if (fcm) await api.put('/fcm-token', { fcm_token: fcm });
  if (!listening) {
    listening = true;
    onTokenRefresh(messaging, (t) => {
      if (hasToken()) api.put('/fcm-token', { fcm_token: t }).catch(() => undefined);
    });
  }
}
