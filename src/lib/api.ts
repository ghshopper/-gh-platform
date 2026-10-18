// Same API as the app, on the same domain (no CORS, no keys in the page).
export const API_BASE = '/api';
export const SITE_BASE = typeof window !== 'undefined' ? window.location.origin : 'https://ghshopper.com';

const TOKEN_KEY = 'gh_token';
let token: string | null = null;
try {
  token = localStorage.getItem(TOKEN_KEY);
} catch {
  token = null;
}
let onUnauthorized: (() => void) | null = null;

export function setToken(value: string | null) {
  token = value;
  try {
    if (value) localStorage.setItem(TOKEN_KEY, value);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // private mode: keep it in memory
  }
}
export const hasToken = () => !!token;
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};

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

function buildUrl(path: string, query?: Query): string {
  const url = path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
  if (!query) return url;
  const qs = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return qs ? `${url}${url.includes('?') ? '&' : '?'}${qs}` : url;
}

async function request<T>(method: string, path: string, opts: { query?: Query; body?: unknown; form?: FormData } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), { method, headers, body });
  } catch {
    throw new ApiError(messageFrom(null, 0), 0);
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
  get: <T,>(path: string, query?: Query) => request<T>('GET', path, { query }),
  post: <T,>(path: string, body?: unknown) => request<T>('POST', path, { body }),
  put: <T,>(path: string, body?: unknown) => request<T>('PUT', path, { body }),
  del: <T,>(path: string) => request<T>('DELETE', path),
  upload: <T,>(path: string, form: FormData) => request<T>('POST', path, { form }),
};

export function imageUrl(path?: string | null): string {
  if (!path) return '';
  let p = path.trim();
  p = p.replace(/^http:\/\/(127\.0\.0\.1|localhost):8000/, '');
  if (/^https?:\/\//.test(p)) return p;
  if (!p.startsWith('/')) p = `/${p}`;
  if (!p.startsWith('/storage')) p = `/storage${p}`;
  return p;
}

export function listOf<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === 'object' && Array.isArray((raw as { data?: unknown }).data)) return (raw as { data: T[] }).data;
  return [];
}

export const asset = (name: string) => `${import.meta.env.BASE_URL}${name}`;
