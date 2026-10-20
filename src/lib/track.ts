/**
 * Tells the shop which page is open (for "who is on now" and visit
 * statistics in the dashboard), and reports page errors. No names, no
 * cookies: a random id kept in this browser. Never blocks or breaks the page.
 */
import { API_BASE } from './api';

const KEY = 'gh_sid';
let sid = '';
let first = false;
try {
  sid = localStorage.getItem(KEY) || '';
  if (!sid) {
    sid = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(KEY, sid);
    first = true;
  }
} catch {
  sid = Math.random().toString(36).slice(2, 14) + Date.now().toString(36);
}

// A campaign link (ghshopper.com/c/…) brings ?cmp=… : remembered 7 days for the order
const CMP = 'gh_cmp';
let cmpNow = '';
try {
  const c = new URLSearchParams(location.search).get('cmp');
  if (c && /^[A-Za-z0-9]{3,24}$/.test(c)) {
    cmpNow = c;
    localStorage.setItem(CMP, JSON.stringify({ c, at: Date.now() }));
  }
} catch {
  // ignore
}
/** The campaign that brought this visitor in the last 7 days (for the order). */
export function currentCampaign(): string | null {
  try {
    const v = JSON.parse(localStorage.getItem(CMP) || 'null') as { c: string; at: number } | null;
    return v && Date.now() - v.at < 7 * 86400000 ? v.c : null;
  } catch {
    return null;
  }
}

const platform = /iPhone|iPad|Android|Mobile/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
let current = location.pathname;
let cartCount = 0;

function send(path: string, body: Record<string, unknown>) {
  try {
    const token = localStorage.getItem('gh_token');
    fetch(`${API_BASE}${path}`, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    }).catch(() => undefined);
  } catch {
    // never mind
  }
}

/** A new page opened. */
export function trackPage(path: string) {
  current = path;
  send('/t', { sid, source: 'web', platform, path, ref: first || cmpNow ? document.referrer : undefined, first, cart: cartCount, cmp: cmpNow || undefined });
  first = false;
  cmpNow = '';
}

export function setTrackedCart(n: number) {
  cartCount = n;
}

// still here: a beat every minute while the tab is visible
setInterval(() => {
  if (document.visibilityState === 'visible') send('/t', { sid, source: 'web', platform, path: current, beat: true, cart: cartCount });
}, 60000);

// page errors (each one once, at most 5 per visit)
const seen = new Set<string>();
function report(kind: string, message: string, where?: string) {
  if (!message || seen.size >= 5 || seen.has(message)) return;
  if (/ResizeObserver|Script error|chrome-extension|moz-extension/i.test(message + (where ?? ''))) return;
  seen.add(message);
  send('/t/error', { source: 'web', kind, message: message.slice(0, 1500), where: where?.slice(0, 300), path: current });
}
window.addEventListener('error', (e) => report('Error', e.message, e.filename ? `${e.filename}:${e.lineno}` : undefined));
window.addEventListener('unhandledrejection', (e) => {
  const r = e.reason as { message?: string; name?: string } | string | undefined;
  // failed API calls (offline, 4xx) are not bugs
  const msg = typeof r === 'string' ? r : r?.message ?? '';
  if (/Failed to fetch|NetworkError|Load failed|401|422|404/.test(msg)) return;
  report(typeof r === 'object' && r?.name ? r.name : 'Promise', msg);
});
