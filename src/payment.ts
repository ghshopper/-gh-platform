import { Platform } from 'react-native';
import { AmwalPaySDK, Currency, Environment, TransactionType, initiate, onResponse, UuidUtil, type AmwalPayResponse } from 'react-amwal-pay';
import { api } from './api';

/**
 * Amwal Pay, wired exactly like the previous app: the server's
 * /customer/amwal-session gives the merchant, terminal, hash and session
 * token (nothing about the Amwal account or the server changes).
 */
interface Session {
  merchant_id?: string | number;
  terminal_id?: string | number;
  transaction_id?: string;
  secure_hash?: string;
  session_token?: string;
  token?: string;
  is_live?: boolean | string | number;
}

export type PayResult = { ok: true; transactionId: string; raw: string } | { ok: false; cancelled?: boolean; raw: string };

const SUCCESS = ['success', 'paid', 'completed', 'approved', 'captured'];

/** Only an explicit success counts (same rule as the previous app). */
function isSuccess(r: AmwalPayResponse | unknown): boolean {
  const status = String((r as { status?: unknown } | null)?.status ?? '').toLowerCase();
  if (SUCCESS.includes(status)) return true;
  const text = JSON.stringify(r ?? '').toLowerCase().replace(/\s/g, '');
  return SUCCESS.some((s) => text.includes(`"status":"${s}"`));
}

export const AMWAL_CODES = ['amwalpay', 'card', 'amwal_apple', 'amwal_google'];

export async function payWithAmwal(amount: number, wallet: boolean, isAr: boolean): Promise<PayResult> {
  const s = await api.post<Session>('/customer/amwal-session', { amount: Number(amount.toFixed(3)) });
  if (!s?.merchant_id) throw new Error(isAr ? 'تعذّر بدء الدفع' : 'Could not start the payment');
  const live = s.is_live === true || s.is_live === 1 || s.is_live === '1' || s.is_live === 'true';
  const transactionId = s.transaction_id || UuidUtil.generateTransactionId();
  const token = s.session_token || s.token || '';

  const config = {
    environment: live ? Environment.PROD : Environment.UAT,
    secureHash: String(s.secure_hash ?? ''),
    currency: Currency.OMR,
    amount: amount.toFixed(3),
    merchantId: String(s.merchant_id),
    terminalId: String(s.terminal_id ?? ''),
    locale: isAr ? 'ar' : 'en',
    transactionType: wallet ? (Platform.OS === 'ios' ? TransactionType.APPLE_PAY : TransactionType.GOOGLE_PAY) : TransactionType.CARD_WALLET,
    transactionId,
    merchantReference: transactionId,
    additionValues: {
      merchantIdentifier: 'merchant.com.ghshopper.app',
      initiativeContext: 'ghshopper.com',
      merchantName: 'GH Shopper',
      ignoreReceipt: 'false',
      useBottomSheetDesign: 'true',
      primaryColor: '#111111',
      secondaryColor: '#8A6A2E',
    },
  };

  return new Promise<PayResult>((resolve) => {
    let done = false;
    const finish = (r: PayResult) => {
      if (done) return;
      done = true;
      sub?.remove();
      clearTimeout(timer);
      resolve(r);
    };
    const timer = setTimeout(() => finish({ ok: false, raw: 'timeout' }), 5 * 60 * 1000);
    let sub: { remove: () => void } | null = null;

    const handle = (r: AmwalPayResponse) => {
      const raw = JSON.stringify(r ?? {});
      finish(isSuccess(r) ? { ok: true, transactionId, raw } : { ok: false, raw, cancelled: /cancel/i.test(raw) });
    };

    try {
      if (token) {
        sub = onResponse(handle);
        initiate({ ...config, sessionToken: token });
      } else {
        // Same fallback as before: let the SDK fetch the session token itself.
        AmwalPaySDK.getInstance()
          .startPayment({ ...config, onResponse: handle, onCustomerId: () => undefined })
          .catch(() => finish({ ok: false, raw: 'start failed' }));
      }
    } catch (e) {
      finish({ ok: false, raw: e instanceof Error ? e.message : 'error' });
    }
  });
}
