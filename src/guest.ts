import AsyncStorage from '@react-native-async-storage/async-storage';

// Orders placed without an account are remembered on this phone (same idea as
// the previous app's "orders saved on this device").
const KEY = 'guest_tokens';

export async function rememberGuestOrder(token: string): Promise<void> {
  const list = await guestTokens();
  if (!list.includes(token)) await AsyncStorage.setItem(KEY, JSON.stringify([token, ...list].slice(0, 50)));
}

export async function guestTokens(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
