import { router } from 'expo-router';

/**
 * Where a push / in-app notification of a new feature opens (features §3):
 * quote, chat, purchase_photo, wallet, review_service. Returns false for
 * other types so the existing rules handle them exactly as before.
 */
export function openFeatureTarget(type: string, data: Record<string, unknown>): boolean {
  const s = (k: string) => (data[k] !== undefined && data[k] !== null && data[k] !== '' ? String(data[k]) : '');
  switch (type) {
    case 'quote':
      router.push({ pathname: '/requests', params: s('request_id') ? { id: s('request_id') } : {} });
      return true;
    case 'chat':
      router.push('/chat');
      return true;
    case 'purchase_photo':
      if (s('ps_order_id')) router.push({ pathname: '/order/[id]', params: { id: s('ps_order_id') } });
      else router.push('/orders');
      return true;
    case 'wallet':
      router.push('/wallet');
      return true;
    case 'review_service':
      router.push({ pathname: '/service-review', params: { ps_order_id: s('ps_order_id'), order_id: s('order_id'), invoice_no: s('invoice_no') } });
      return true;
    default:
      return false;
  }
}
