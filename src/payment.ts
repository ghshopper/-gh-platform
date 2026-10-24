import { Platform } from 'react-native';
import { AmwalPaySDK, Currency, Environment, TransactionType, initiate, onResponse, UuidUtil, type AmwalPayResponse } from 'react-amwal-pay';
import { api } from './api';

/**
 * Amwal Pay, wired exactly like the previous app: the server's
 * /customer/amwal-session gives the merchant, terminal, hash and session
 * token (nothing about the Amwal account or the server changes).
 */
export interface Session {
  merchant_id?: string | number;
  terminal_id?: string | number;
  transaction_id?: string;
  secure_hash?: string;
  session_token?: string;
  token?: string;
  is_live?: boolean | string | number;
}

export type PayResult =
  | { ok: true; transactionId: string; reference: string; raw: string }
  | { ok: false; cancelled?: boolean; raw: string }
  /** The SDK answered but in a shape we could not read: let the shop check it. */
  | { ok: 'unknown'; transactionId: string; reference: string; raw: string };

const SUCCESS = ['success', 'succeeded', 'successful', 'paid', 'completed', 'approved', 'captured', 'authorized', 'authorised'];
const FAILURE = /fail|declin|reject|cancel|error|denied|invalid|expired|timeout/i;
const STATUS_KEYS = ['status', 'transactionstatus', 'paymentstatus', 'state', 'result', 'responsestatus', 'message'];
const REF_KEYS = ['transactionid', 'referencenumber', 'reference', 'rrn', 'hostreference', 'systemtraceauditnumber', 'merchantreference', 'id'];

/** Flatten the SDK's answer: nested objects and JSON-in-a-string included. */
function flatten(v: unknown, out: [string, string][], key = '', depth = 0): void {
  if (depth > 6 || v === null || v === undefined) return;
  if (typeof v === 'string') {
    const t = v.trim();
    if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) {
      try {
        flatten(JSON.parse(t), out, key, depth + 1);
        return;
      } catch {
        // plain text
      }
    }
    out.push([key, t]);
    return;
  }
  if (typeof v === 'number' || typeof v === 'boolean') {
    out.push([key, String(v)]);
    return;
  }
  if (Array.isArray(v)) {
    v.forEach((x) => flatten(x, out, key, depth + 1));
    return;
  }
  if (typeof v === 'object') {
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) flatten(x, out, k.toLowerCase(), depth + 1);
  }
}

export function readAmwalResponse(r: unknown): { verdict: 'ok' | 'fail' | 'cancel' | 'unknown'; reference: string } {
  const pairs: [string, string][] = [];
  flatten(r, pairs);
  let good = false;
  let bad = false;
  let cancel = false;
  for (const [k, v] of pairs) {
    const val = v.toLowerCase();
    if (STATUS_KEYS.includes(k)) {
      if (SUCCESS.includes(val)) good = true;
      else if (FAILURE.test(val)) {
        bad = true;
        if (/cancel/.test(val)) cancel = true;
      }
    }
    if ((k === 'success' || k === 'issuccess' || k === 'issuccessful') && (val === 'true' || val === '1')) good = true;
    if ((k === 'success' || k === 'issuccess') && val === 'false') bad = true;
    if ((k === 'responsecode' || k === 'hostresponsecode') && (val === '00' || val === '000')) good = true;
    if (k === 'message' && /approved|authori[sz]ed|success|ناجح|تمت/.test(val) && !FAILURE.test(val)) good = true;
  }
  const refPair = REF_KEYS.map((rk) => pairs.find(([k, v]) => k === rk && v.length > 3)).find(Boolean);
  const reference = refPair ? refPair[1] : '';
  if (bad) return { verdict: cancel ? 'cancel' : 'fail', reference };
  if (good) return { verdict: 'ok', reference };
  return { verdict: 'unknown', reference };
}

export const AMWAL_CODES = ['amwalpay', 'card', 'amwal_apple', 'amwal_google'];

/**
 * `start` lets another flow (the GH wallet top-up) get the same session from
 * its own endpoint; orders keep using /customer/amwal-session exactly as before.
 */
export async function payWithAmwal(
  amount: number,
  wallet: boolean,
  isAr: boolean,
  start?: () => Promise<Session>,
): Promise<PayResult> {
  const s = start ? await start() : await api.post<Session>('/customer/amwal-session', { amount: Number(amount.toFixed(3)) });
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
    customerId: null,
    // APPLE_PAY is the SDK's wallet type on both platforms (Google Pay on Android).
    transactionType: wallet ? TransactionType.APPLE_PAY : TransactionType.CARD_WALLET,
    transactionId,
    // Exactly the values the previous (working) app sent: full-screen SDK
    // page, its own colours, no merchant reference.
    additionValues: {
      merchantIdentifier: 'merchant.com.ghshopper.app',
      initiativeContext: 'ghshopper.com',
      merchantName: 'GH Shopper',
      ignoreReceipt: 'false',
      useBottomSheetDesign: 'false',
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
      const { verdict, reference } = readAmwalResponse(r);
      if (verdict === 'ok') finish({ ok: true, transactionId, reference, raw });
      else if (verdict === 'unknown' && raw.length > 2) finish({ ok: 'unknown', transactionId, reference, raw });
      else finish({ ok: false, raw, cancelled: verdict === 'cancel' });
    };

    try {
      if (token) {
        sub = onResponse(handle);
        initiate({ ...config, sessionToken: token, onResponse: () => undefined, onCustomerId: () => undefined });
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
