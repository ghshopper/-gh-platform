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

export const CARRIER: Record<string, { ar: string; en: string; branch: boolean } | undefined> = {
  nool: { ar: 'نول', en: 'Nool', branch: false },
  nool_office: { ar: 'نول', en: 'Nool', branch: true },
  genacom: { ar: 'جيناكم', en: 'Genacom', branch: false },
  genacom_office: { ar: 'جيناكم', en: 'Genacom', branch: true },
};
