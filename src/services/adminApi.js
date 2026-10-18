import api from './api';

export const adminApi = {
  // Dashboard
  getDashboardStats: () => api.get('/admin/dashboard/stats'),

  // Orders
  getOrders: (params) => api.get('/admin/orders', { params }),
  getOrder: (id) => api.get(`/admin/orders/${id}`),
  updateOrderStatus: (id, status, trackingData = {}) => api.put(`/admin/orders/${id}/status`, { status, ...trackingData }),
  updateOrderState: (id, payload) => api.put(`/admin/orders/${id}/status`, payload),
  deleteOrder: (id) => api.delete(`/admin/orders/${id}`),
  bulkDeleteOrders: (ids) => api.post('/admin/orders/bulk-delete', { ids }),

  // Customers
  getCustomers: (params) => api.get('/admin/customers', { params }),
  getCustomer: (id) => api.get(`/admin/customers/${id}`),
  createCustomer: (data) => api.post('/admin/customers', data),
  updateCustomer: (id, data) => api.put(`/admin/customers/${id}`, data),
  deleteCustomer: (id) => api.delete(`/admin/customers/${id}`),

  // Users & Staff
  getUsers: (params) => api.get('/admin/users', { params }),
  getUser: (id) => api.get(`/admin/users/${id}`),
  getUserRoles: () => api.get('/admin/users/roles'),
  createUser: (data) => api.post('/admin/users', data),
  updateUser: (id, data) => api.put(`/admin/users/${id}`, data),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  toggleUserStatus: (id) => api.post(`/admin/users/${id}/toggle-status`),

  // Payment Gateways
  getPaymentGateways: () => api.get('/admin/payment-gateways'),
  getPaymentGateway: (id) => api.get(`/admin/payment-gateways/${id}`),
  updatePaymentGateway: (id, data) => api.put(`/admin/payment-gateways/${id}`, data),

  // Invoices
  getInvoices: (params) => api.get('/admin/invoices', { params }),
  getInvoice: (id) => api.get(`/admin/invoices/${id}`),
  createInvoice: (data) => api.post('/admin/invoices', data),
  updateInvoice: (id, data) => api.put(`/admin/invoices/${id}`, data),
  deleteInvoice: (id) => api.delete(`/admin/invoices/${id}`),
  bulkDeleteInvoices: (ids) => api.post('/admin/invoices/bulk-delete', { ids }),
  sendInvoice: (id) => api.post(`/admin/invoices/${id}/send`),
  downloadInvoicePdf: (id) => api.get(`/admin/invoices/${id}/pdf`, { responseType: 'blob' }),

  // Payments
  getPayments: (params) => api.get('/admin/payments', { params }),
  getPayment: (id) => api.get(`/admin/payments/${id}`),
  updatePaymentStatus: (id, status, notes) => api.put(`/admin/payments/${id}/status`, { status, notes }),

  // Shipping & Logistics
  getShipments: (params) => api.get('/admin/shipping', { params }),
  getShipment: (id) => api.get(`/admin/shipping/${id}`),
  updateShipment: (id, data) => api.put(`/admin/shipping/${id}`, data),
  addShippingEvent: (id, data) => api.post(`/admin/shipping/${id}/events`, data),
  getShippingCarriers: () => api.get('/admin/shipping/carriers'),
  
  // Shipping Countries
  getShippingCountries: () => api.get('/admin/shipping-countries'),
  createShippingCountry: (data) => api.post('/admin/shipping-countries', data),
  updateShippingCountry: (id, data) => api.put(`/admin/shipping-countries/${id}`, data),
  deleteShippingCountry: (id) => api.delete(`/admin/shipping-countries/${id}`),

  // Reports & Analytics
  getReportsOverview: (params) => api.get('/admin/reports/overview', { params }),

  // Settings
  getSettings: (group) => api.get('/admin/settings', { params: { group } }),
  updateSettings: (group, data) => api.post(`/admin/settings?group=${group}`, data),
  testEmail: (email) => api.post('/admin/settings/test-email', { email }),
  testPush: (phone) => api.post('/admin/settings/test-push', { phone: phone || null }),

  // AI Import
  importProductAi: (data) => api.post('/admin/products/import-ai', data),
};
