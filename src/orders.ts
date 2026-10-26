import { api, hasToken } from './api';
import { guestTokens } from './guest';
import type { MyOrder, MyOrdersResponse } from './types';

let cache: MyOrdersResponse | null = null;

/** Every order of this customer: app, website and WhatsApp (one list). */
export async function fetchMyOrders(): Promise<MyOrdersResponse> {
  if (hasToken()) {
    cache = await api.get<MyOrdersResponse>('/ps/my-orders');
  } else {
    const tokens = await guestTokens();
    cache = tokens.length
      ? await api.post<MyOrdersResponse>('/ps/guest-orders', { tokens })
      : { customer: { name: '' }, company: {}, orders: [] };
  }
  return cache;
}

export function cachedOrders(): MyOrdersResponse | null {
  return cache;
}

export function cachedOrder(id: string): MyOrder | undefined {
  return cache?.orders.find((o) => o.id === id);
}

export const STATUS: Record<MyOrder['status'], { ar: string; en: string; step: number }> = {
  requested: { ar: 'استلمنا طلبك', en: 'Order received', step: 0 },
  purchased: { ar: 'تم الشراء', en: 'Purchased', step: 1 },
  arrived: { ar: 'وصل عُمان', en: 'Arrived in Oman', step: 2 },
  out_for_delivery: { ar: 'في الطريق إليك', en: 'On the way', step: 3 },
  delivered: { ar: 'تم التسليم', en: 'Delivered', step: 4 },
};

/** The short journey of an order whose pieces were all here (تسليم فوري). */
export const QUICK_STEPS = [
  { ar: 'استلمناه', en: 'Received' },
  { ar: 'جاهز', en: 'Ready' },
  { ar: 'في الطريق', en: 'On the way' },
  { ar: 'تم التسليم', en: 'Delivered' },
];

/** Status label and step for an order, the short journey when every piece was here. */
export function orderStage(o: MyOrder): { ar: string; en: string; step: number; quick: boolean } {
  const st = STATUS[o.status];
  if (!o.all_instant) return { ...st, quick: false };
  if (o.status === 'delivered') return { ...st, step: 3, quick: true };
  if (o.status === 'out_for_delivery') return { ...st, step: 2, quick: true };
  if (o.status === 'requested') return { ar: 'استلمنا طلبك', en: 'Order received', step: 0, quick: true };
  return { ar: 'طلبك جاهز', en: 'Ready', step: 1, quick: true };
}

export const CARRIER: Record<string, { ar: string; en: string; branch: boolean } | undefined> = {
  nool: { ar: 'نول', en: 'Nool', branch: false },
  nool_office: { ar: 'نول', en: 'Nool', branch: true },
  genacom: { ar: 'جيناكم', en: 'Genacom', branch: false },
  genacom_office: { ar: 'جيناكم', en: 'Genacom', branch: true },
  gcc_genacom: { ar: 'جيناكم', en: 'Genacom', branch: false },
  gcc_dhl: { ar: 'DHL', en: 'DHL', branch: false },
};
