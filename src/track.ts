import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import { API_BASE, currentToken } from './api';

/**
 * Tells the shop which screen is open (for "who is on now" and visit
 * statistics in the dashboard), and reports crashes. No names: a random id
 * kept on this phone. Never blocks or breaks the app.
 */
const KEY = 'app_sid';
let sid = '';
let first = false;
let current = '/';
let cartCount = 0;
const ready = AsyncStorage.getItem(KEY)
  .then(async (v) => {
    if (v) {
      sid = v;
      return;
    }
    sid = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
    first = true;
    await AsyncStorage.setItem(KEY, sid);
  })
  .catch(() => {
    sid = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  });

function send(path: string, body: Record<string, unknown>) {
  const token = currentToken();
  fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  }).catch(() => undefined);
}

/** A screen opened. */
export function trackScreen(path: string) {
  current = path || '/';
  ready.then(() => {
    send('/t', { sid, source: 'app', platform: Platform.OS, path: current, first, cart: cartCount });
    first = false;
  });
}

export function setTrackedCart(n: number) {
  cartCount = n;
}

// still here: a beat every minute while the app is in front
setInterval(() => {
  if (AppState.currentState === 'active' && sid) send('/t', { sid, source: 'app', platform: Platform.OS, path: current, beat: true, cart: cartCount });
}, 60000);

// crashes (each once, at most 5 per launch), then the usual handler
const seen = new Set<string>();
type Handler = (error: Error, isFatal?: boolean) => void;
const g = globalThis as unknown as { ErrorUtils?: { getGlobalHandler: () => Handler; setGlobalHandler: (h: Handler) => void } };
if (g.ErrorUtils) {
  const prev = g.ErrorUtils.getGlobalHandler();
  g.ErrorUtils.setGlobalHandler((error, isFatal) => {
    try {
      const msg = String(error?.message ?? error).slice(0, 1500);
      if (msg && seen.size < 5 && !seen.has(msg)) {
        seen.add(msg);
        send('/t/error', { source: 'app', kind: `${isFatal ? 'Crash' : 'Error'} · ${Platform.OS}`, message: msg, where: String(error?.stack ?? '').split('\n')[1]?.trim().slice(0, 300), path: current });
      }
    } catch {
      // never mind
    }
    prev(error, isFatal);
  });
}
