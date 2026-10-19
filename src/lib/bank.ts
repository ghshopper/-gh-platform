import { api } from './api';

export interface BankDetails {
  bank_name?: string;
  account_name?: string;
  account_number?: string;
  iban?: string;
  note?: string;
}

/** The bank account for transfers (null when bank transfer is off). */
export async function bankDetails(): Promise<BankDetails | null> {
  try {
    const r = await api.get<{ data?: { code: string; details?: BankDetails }[] }>('/customer/payment-gateways');
    const g = (r?.data ?? []).find((x) => x.code === 'bank_transfer');
    return g?.details ?? null;
  } catch {
    return null;
  }
}
