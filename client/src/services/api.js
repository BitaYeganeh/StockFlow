const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8005/api';

// Turn an HTTP status + raw server message into something a user can act on
function friendlyMessage(status, serverMessage, hadToken) {
  if (status === 401) {
    return hadToken
      ? 'Your session has expired. Please sign in again.'
      : 'Please sign in with Google to do this.';
  }
  if (status === 403) return "You don't have permission to do this.";
  if (status === 404) return serverMessage || 'Not found. It may have been deleted.';
  if (status === 400 || status === 422) return serverMessage || 'Please check the form and try again.';
  if (status >= 500) return 'Something went wrong on the server. Please try again in a moment.';
  return serverMessage || `Request failed (${status}).`;
}

async function fetchApi(endpoint, options = {}) {
  const token = localStorage.getItem('supabase_token');

  // Don't set Content-Type for FormData — the browser sets it automatically
  // with the correct multipart boundary
  const isFormData = options.body instanceof FormData;

  const headers = {
    ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  let res;
  try {
    res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  } catch {
    throw new Error("Can't reach the server. Check your connection and try again.");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const error = new Error(friendlyMessage(res.status, body.error || body.message, !!token));
    error.status = res.status;

    // Expired/invalid token: drop it and tell App to show the signed-out state
    if (res.status === 401 && token) {
      localStorage.removeItem('supabase_token');
      window.dispatchEvent(new Event('auth:expired'));
    }
    throw error;
  }

  const json = await res.json();
  console.log('[API] Response from', endpoint, ':', json); // DEBUG log
  return json;
}

export const api = {
  // Auth
  getLoginUrl: () => fetchApi('/auth/login-url'),
  getUser: () => fetchApi('/auth/user'),

  // Products (Exercise 1, 2, 4)
  getProducts: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchApi(`/products${query ? '?' + query : ''}`);
  },
  getProduct: (id) => fetchApi(`/products/${id}`),
  createProduct: (data) =>
    fetchApi('/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id, data) =>
    fetchApi(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProduct: (id) =>
    fetchApi(`/products/${id}`, { method: 'DELETE' }),
  uploadProductImage: (file) => {
    const formData = new FormData();
    formData.append('image', file);
    return fetchApi('/products/upload-image', { method: 'POST', body: formData });
  },

  // Orders (Exercise 3, 5)
  getOrders: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const endpoint = `/orders${query ? '?' + query : ''}`;
    console.log('[API] Fetching orders from:', endpoint); // DEBUG log
    return fetchApi(endpoint);
  },
  getOrder: (id) => fetchApi(`/orders/${id}`),
  createOrder: (data) =>
    fetchApi('/orders', { method: 'POST', body: JSON.stringify(data) }),
  updateOrderStatus: (id, status) =>
    fetchApi(`/orders/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),

  // Stock Movements (Exercise 3)
  getStockMovements: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchApi(`/stock/movements${query ? '?' + query : ''}`);
  },
  createStockMovement: (data) =>
    fetchApi('/stock/movements', { method: 'POST', body: JSON.stringify(data) }),

  // AI (Exercise 6)
  generateDescription: (productId) =>
    fetchApi('/ai/describe', { method: 'POST', body: JSON.stringify({ product_id: productId }) }),
  getStockAdvice: () =>
    fetchApi('/ai/stock-advice', { method: 'POST' }),
  summarizeOrders: () =>
    fetchApi('/ai/summarize-orders', { method: 'POST' }),

  // Dashboard (Exercise 7)
  getDashboardSummary: () => fetchApi('/dashboard/summary'),
};