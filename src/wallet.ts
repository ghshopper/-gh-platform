import * as WebBrowser from 'expo-web-browser';
import { Alert } from 'react-native';
import { api } from './api';
import { num, omrReal } from './format';
import { payWithAmwal, type Session } from './payment';

/** محفظة GH: GET /customer/wallet. */
export interface WalletTx {
  id: number;
  type: 'topup' | 'points' | 'spend' | 'refund' | 'credit' | 'debit' | string;
  type_label_ar?: string | null;
  amount: number | string;
  balance_after?: number | string | null;
  note?: string | null;
  order_number?: string | null;
  created_at?: string | null;
}

export interface WalletInfo {
  balance: number;
  transactions: WalletTx[];
  points: number;
  point_value: number;
  points_convert: boolean;
  topup: boolean;
  topup_min: number;
  topup_max: number;
}

export const WALLET_TYPE: Record<string, [string, string]> = {
  topup: ['شحن رصيد', 'Top-up'],
  points: ['تحويل نقاط', 'Points converted'],
  spend: ['دفع طلب', 'Order payment'],
  refund: ['استرجاع', 'Refund'],
  credit: ['إضافة من GH', 'Credit from GH'],
  debit: ['خصم', 'Debit'],
  gift_card: ['بطاقة هدية', 'Gift card'],
};

export async function fetchWallet(): Promise<WalletInfo> {
  const r = await api.get<Record<string, unknown>>('/customer/wallet');
  const o = (r && typeof r.data === 'object' && r.data && !('balance' in r) ? r.data : r) as Record<string, unknown>;
  return {
    balance: num(o.balance),
    transactions: Array.isArray(o.transactions) ? (o.transactions as WalletTx[]) : [],
    points: num(o.points),
    point_value: num(o.point_value, 0.01),
    points_convert: o.points_convert !== false && o.points_convert !== 0,
    topup: o.topup !== false && o.topup !== 0,
    topup_min: num(o.topup_min, 5),
    topup_max: num(o.topup_max, 1000),
  };
}

/** Just the balance (0 when the wallet is off, signed out or offline). */
export async function walletBalance(): Promise<number> {
  try {
    return (await fetchWallet()).balance;
  } catch {
    return 0;
  }
}

/**
 * Top up with the native Amwal SDK, the same way checkout charges an order:
 * the server opens a pending top-up and hands back the Amwal session, the SDK
 * charges, then the server checks the transaction with Amwal and credits.
 */
export async function topUpWallet(amount: number, applePay: boolean, isAr: boolean): Promise<{ paid: boolean; balance: number; cancelled?: boolean }> {
  let reference = '';
  const r = await payWithAmwal(amount, applePay, isAr, async () => {
    const s = await api.post<Session & { reference?: string }>('/customer/wallet/topup/session', { amount: Number(amount.toFixed(3)) });
    reference = String(s?.reference ?? '');
    return s;
  });
  if (r.ok === false) return { paid: false, balance: 0, cancelled: r.cancelled };
  if (!reference) throw new Error(isAr ? 'تعذّر تأكيد الشحن' : 'Could not confirm the top-up');
  // The server asks Amwal about the transaction; "unknown" answers are checked the same way.
  const c = await api.post<{ paid?: boolean; balance?: number | string }>('/customer/wallet/topup/confirm', {
    reference,
    amwal_transaction_id: r.transactionId,
  });
  return { paid: !!c?.paid, balance: num(c?.balance) };
}

/** Move a gift card's whole remaining balance into رصيدك. 422 → its message. */
export async function redeemGift(code: string): Promise<{ added: number; balance: number }> {
  const r = await api.post<{ added?: number | string; balance?: number | string }>('/customer/wallet/redeem-gift', { code: code.trim() });
  return { added: num(r?.added), balance: num(r?.balance) };
}

export async function convertPoints(points: number): Promise<{ balance: number; points: number }> {
  const r = await api.post<{ balance?: number | string; points?: number | string }>('/customer/wallet/convert', { points });
  return { balance: num(r?.balance), points: num(r?.points) };
}

/** The token in a pay link ("…/pay/?t=TOKEN"). */
export function payTokenOf(url?: string | null): string {
  const m = /[?&]t=([^&#]+)/.exec(url ?? '');
  return m ? decodeURIComponent(m[1]) : '';
}

function ask(title: string, message: string, yes: string, no: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: no, style: 'cancel', onPress: () => resolve(false) },
      { text: yes, onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

/**
 * Pay a Ps order (a pay link, e.g. after accepting a quote): first offer the
 * GH wallet when it has a balance, then the rest by card on the secure Amwal
 * pay page in the in-app browser (pay links have no native SDK flow).
 */
export async function payPsOrder(opts: {
  token?: string | null;
  payUrl?: string | null;
  walletOn: boolean;
  tr: (ar: string, en: string) => string;
}): Promise<void> {
  const { tr, walletOn } = opts;
  const token = opts.token || payTokenOf(opts.payUrl);
  let due: number | null = null;
  if (walletOn && token) {
    try {
      const info = await api.get<{ remaining?: number | string; wallet?: { available?: boolean; balance?: number | string } }>(`/ps/pay/${token}`);
      due = num(info?.remaining, NaN);
      const bal = num(info?.wallet?.balance);
      if (info?.wallet?.available && bal > 0.0005 && !(due <= 0.0005)) {
        const use = Number.isFinite(due) ? Math.min(bal, due) : bal;
        const yes = await ask(
          tr('رصيدك', 'Your balance'),
          tr(`رصيدك ${omrReal(bal)}. تبي تدفع ${omrReal(use)} من رصيدك؟`, `Your balance is ${omrReal(bal)}. Pay ${omrReal(use)} from your balance?`),
          tr('استخدم رصيدك', 'Use my balance'),
          tr('بالبطاقة فقط', 'Card only'),
        );
        if (yes) {
          const r = await api.post<{ paid_amount?: number | string; due?: number | string; balance?: number | string }>(`/ps/pay/${token}/wallet`, {});
          due = num(r?.due);
          if (due <= 0.0005) {
            Alert.alert(tr('تم الدفع 🤍', 'Paid 🤍'), tr(`انخصم ${omrReal(r?.paid_amount)} من رصيدك، وطلبك مدفوع بالكامل.`, `${omrReal(r?.paid_amount)} was paid from your balance. Your order is fully paid.`));
            return;
          }
        }
      }
    } catch (e) {
      Alert.alert(tr('رصيدك', 'Your balance'), e instanceof Error ? e.message : '');
    }
  }
  if (due !== null && due <= 0.0005) return;
  if (opts.payUrl) await WebBrowser.openBrowserAsync(opts.payUrl);
}
