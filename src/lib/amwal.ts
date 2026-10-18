import { api } from './api';

/* Amwal SmartBox on the website. The server signs the configuration; after
   paying, the server confirms with Amwal before the order counts as paid. */

declare global {
  interface Window {
    SmartBox?: { Checkout: { configure: Record<string, unknown>; showSmartBox: () => void } };
  }
}

interface StartResponse {
  paid?: boolean;
  script?: string;
  config?: Record<string, unknown>;
  message?: string;
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.SmartBox && document.querySelector(`script[data-amwal="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.dataset.amwal = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('تعذّر تحميل صفحة الدفع'));
    document.head.appendChild(s);
  });
}

export async function verifyPayment(orderNumber: string, guestToken?: string | null, tries = 4): Promise<boolean> {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await api.post<{ paid?: boolean }>('/customer/web-pay/verify', { order_number: orderNumber, guest_token: guestToken || undefined });
      if (r?.paid) return true;
    } catch {
      // try again
    }
    await new Promise((res) => setTimeout(res, 2000));
  }
  return false;
}

/** Opens the payment box. Resolves 'paid' | 'failed' | 'cancelled'. */
export async function payOrder(orderNumber: string, guestToken: string | null | undefined, lang: 'ar' | 'en'): Promise<'paid' | 'failed' | 'cancelled'> {
  const r = await api.post<StartResponse>('/customer/web-pay/start', { order_number: orderNumber, guest_token: guestToken || undefined, lang });
  if (r?.paid) return 'paid';
  if (!r?.script || !r.config) throw new Error(r?.message || 'الدفع غير متاح حالياً');
  await loadScript(r.script);
  if (!window.SmartBox) throw new Error('تعذّر فتح صفحة الدفع');
  return new Promise((resolve) => {
    let done = false;
    const finish = async (kind: 'complete' | 'error' | 'cancel') => {
      if (done) return;
      done = true;
      if (kind === 'cancel') return resolve('cancelled');
      // Whatever the box says, Amwal's own record decides.
      resolve((await verifyPayment(orderNumber, guestToken, kind === 'complete' ? 5 : 2)) ? 'paid' : kind === 'error' ? 'failed' : 'failed');
    };
    window.SmartBox!.Checkout.configure = {
      ...r.config,
      completeCallback: () => finish('complete'),
      errorCallback: () => finish('error'),
      cancelCallback: () => finish('cancel'),
    };
    window.SmartBox!.Checkout.showSmartBox();
  });
}
