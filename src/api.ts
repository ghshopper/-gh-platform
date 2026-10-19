import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const extra = (Constants.expoConfig?.extra ?? {}) as { apiBase?: string; siteBase?: string };
export const API_BASE = extra.apiBase ?? 'https://ghshopper.com/api';
export const SITE_BASE = extra.siteBase ?? 'https://ghshopper.com';

const TOKEN_KEY = 'auth_token';
let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export async function loadToken(): Promise<string | null> {
  try {
    token = await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    token = null;
  }
  return token;
}

export async function setToken(value: string | null): Promise<void> {
  token = value;
  try {
    if (value) await SecureStore.setItemAsync(TOKEN_KEY, value);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // keep the in-memory token; it will be asked again next launch
  }
}

export function hasToken(): boolean {
  return !!token;
}

export function setUnauthorizedHandler(fn: () => void): void {
  onUnauthorized = fn;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function messageFrom(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    const errors = b.errors as Record<string, string[]> | undefined;
    if (errors && typeof errors === 'object') {
      const first = Object.values(errors)[0];
      if (Array.isArray(first) && first[0]) return String(first[0]);
    }
    if (typeof b.message === 'string' && b.message) return b.message;
    if (typeof b.error === 'string' && b.error) return b.error;
  }
  if (status === 0) return 'تأكد من الاتصال بالإنترنت';
  if (status === 429) return 'محاولات كثيرة، انتظر دقيقة';
  if (status >= 500) return 'خطأ في الخادم، حاول بعد شوي';
  return 'حدث خطأ، حاول مرة ثانية';
}

type Query = Record<string, string | number | boolean | undefined | null>;

// Women's / men's choice, added to every product list request.
let listGender = '';
export function setListGender(g: string): void {
  listGender = g;
}

function buildUrl(path: string, query?: Query): string {
  if (listGender && /^\/customer\/products(\/featured)?$/.test(path) && !(query && 'gender' in query)) query = { ...(query ?? {}), gender: listGender };
  const url = path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
  if (!query) return url;
  const qs = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return qs ? `${url}${url.includes('?') ? '&' : '?'}${qs}` : url;
}

async function request<T>(
  method: string,
  path: string,
  opts: { query?: Query; body?: unknown; form?: FormData; auth?: boolean; timeoutMs?: number } = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token && opts.auth !== false) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (opts.form) {
    body = opts.form;
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 30000);
  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), { method, headers, body, signal: controller.signal });
  } catch {
    throw new ApiError(messageFrom(null, 0), 0);
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized?.();
    throw new ApiError(messageFrom(json, res.status), res.status);
  }
  return json as T;
}

export const api = {
  get: <T>(path: string, query?: Query, auth?: boolean) => request<T>('GET', path, { query, auth }),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body }),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, { body }),
  del: <T>(path: string) => request<T>('DELETE', path),
  upload: <T>(path: string, form: FormData) => request<T>('POST', path, { form, timeoutMs: 90000 }),
};

/** Full URL for an image path stored by the dashboard ("/storage/x.jpg" or "x.jpg"). */
export function imageUrl(path?: string | null): string {
  if (!path) return '';
  let p = path.trim();
  p = p.replace(/^http:\/\/(127\.0\.0\.1|localhost):8000/, SITE_BASE);
  if (/^https?:\/\//.test(p)) return p;
  if (!p.startsWith('/')) p = `/${p}`;
  if (!p.startsWith('/storage')) p = `/storage${p}`;
  return `${SITE_BASE}${p}`;
}

/** The server sometimes returns a list as {data: [...]}, sometimes bare. */
export function listOf<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === 'object' && Array.isArray((raw as { data?: unknown }).data)) {
    return (raw as { data: T[] }).data;
  }
  return [];
}
