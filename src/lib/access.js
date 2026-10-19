// Which dashboard page belongs to which area (same areas as the server).
const PAGE_AREA = {
  'app-orders': 'orders', 'store-orders': 'orders', 'product-requests': 'orders', 'abandoned-carts': 'orders',
  invoices: 'finance', payments: 'finance', reports: 'finance',
  products: 'products', 'import-items': 'products', categories: 'products', brands: 'products', attributes: 'products', reviews: 'products',
  customers: 'customers', loyalty: 'customers', coupons: 'customers', 'gift-cards': 'customers',
  'customize-app': 'marketing', 'notify-users': 'marketing', faqs: 'marketing',
  shipping: 'shipping',
  users: 'settings', settings: 'settings', whatsapp: 'settings',
}

export const STAFF_ROLES = ['super_admin', 'admin', 'manager', 'sales_manager', 'product_editor', 'shipping_manager', 'accountant', 'support']

export function currentUser() {
  try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} }
}

/** Areas the signed-in person may open (full admins: everything). */
export function myAreas(user = currentUser()) {
  if (user.role === 'super_admin' || user.role === 'admin') return null // all
  return user.access?.areas || []
}

/** True when the page (e.g. "/admin/products") is open to this person. */
export function canOpen(path, user = currentUser()) {
  const areas = myAreas(user)
  if (areas === null) return true
  const page = String(path).replace(/^.*\/admin\/?/, '').split(/[/?#]/)[0]
  if (!page || page === 'dashboard' || page === 'profile') return true
  const area = PAGE_AREA[page]
  return !!area && areas.includes(area)
}
