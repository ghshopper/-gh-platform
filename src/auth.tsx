import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, loadToken, setToken, setUnauthorizedHandler } from './api';
import { registerPushToken } from './push';
import type { User } from './types';

interface AuthCtx {
  ready: boolean;
  user: User | null;
  loggedIn: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, phone: string, password: string) => Promise<void>;
  /** Forgot password: the code from the e-mail and a new password; signs in. */
  resetPassword: (email: string, code: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  updateProfile: (data: { name?: string; email?: string; current_password?: string; new_password?: string }) => Promise<string>;
  deleteAccount: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

interface LoginResponse {
  success?: boolean;
  token?: string;
  user?: User;
  message?: string;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await api.get<{ success?: boolean; user?: User }>('/auth/me');
      if (r?.user) setUser(r.user);
    } catch {
      // offline or expired: keep what we have; 401 is handled globally
    }
  }, []);

  const logout = useCallback(async () => {
    await setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null).catch(() => undefined);
      setUser(null);
    });
    (async () => {
      const t = await loadToken();
      if (t) {
        await refresh();
        registerPushToken().catch(() => undefined);
      }
      setReady(true);
    })();
  }, [refresh]);

  const finish = useCallback(async (r: LoginResponse, fallback: string) => {
    if (!r?.token) throw new Error(r?.message || fallback);
    await setToken(r.token);
    if (r.user) setUser(r.user);
    await refresh();
    registerPushToken().catch(() => undefined);
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      const r = await api.post<LoginResponse>('/auth/login', { email: email.trim(), password });
      await finish(r, 'البريد الإلكتروني أو كلمة المرور غير صحيحة');
    },
    [finish],
  );

  const register = useCallback(
    async (name: string, email: string, phone: string, password: string) => {
      const r = await api.post<LoginResponse>('/auth/register', {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        password,
      });
      await finish(r, 'حدث خطأ أثناء إنشاء الحساب');
    },
    [finish],
  );

  const resetPassword = useCallback(
    async (email: string, code: string, password: string) => {
      const r = await api.post<LoginResponse>('/auth/reset-password', { email: email.trim(), code: code.trim(), password, device: 'app' });
      await finish(r, 'الرمز غير صحيح أو انتهى');
    },
    [finish],
  );

  const updateProfile = useCallback<AuthCtx['updateProfile']>(
    async (data) => {
      const body: Record<string, string> = {};
      for (const [k, v] of Object.entries(data)) if (v) body[k] = v;
      const r = await api.put<{ success?: boolean; message?: string }>('/customer/profile', body);
      if (r?.success === false) throw new Error(r.message || 'حدث خطأ');
      await refresh();
      return r?.message || 'تم الحفظ';
    },
    [refresh],
  );

  const deleteAccount = useCallback(async () => {
    const r = await api.del<{ success?: boolean; message?: string }>('/customer/profile');
    if (r?.success === false) throw new Error(r.message || 'حدث خطأ');
    await logout();
  }, [logout]);

  const value = useMemo<AuthCtx>(
    () => ({ ready, user, loggedIn: !!user, login, register, resetPassword, logout, refresh, updateProfile, deleteAccount }),
    [ready, user, login, register, resetPassword, logout, refresh, updateProfile, deleteAccount],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
