const API_BASE = 'http://localhost:8000';

export type { User, Product, Order, Payment, PaginatedResponse, Stats } from './types';

const getToken = () => localStorage.getItem('token');

const getHeaders = () => {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  console.log('[getHeaders] Token exists:', !!token, 'Headers:', JSON.stringify(headers));
  return headers;
};

const fetchWithTimeout = async (url: string, options: RequestInit, timeout = 10000): Promise<Response> => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw err;
  }
};

export const api = {
  // Auth
  async login(username: string, password: string): Promise<{ access_token: string; token_type: string; user: import('./types').User }> {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    let data;
    try {
      data = await res.json();
    } catch {
      console.error('Failed to parse response:', res.status, res.statusText);
      throw new Error(`Server error: ${res.status} ${res.statusText}`);
    }

    if (!res.ok) {
      console.error('Login error:', res.status, data);
      throw new Error(data.detail || `Login failed with status ${res.status}`);
    }

    localStorage.setItem('token', data.access_token);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data;
  },

  async getMe(): Promise<import('./types').User> {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch user');
    return res.json();
  },

  async register(username: string, email: string, password: string, role: string = 'staff'): Promise<import('./types').User> {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ username, email, password, role }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || 'Registration failed');
    }
    return res.json();
  },

  // Public registration (no auth required) - auto-assigns 'staff' role
  async registerPublic(username: string, email: string, password: string): Promise<import('./types').User> {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || 'Registration failed');
    }
    return res.json();
  },

  async changePassword(currentPassword: string, newPassword: string, confirmPassword: string): Promise<{ message: string }> {
    const formData = new FormData();
    formData.append('current_password', currentPassword);
    formData.append('new_password', newPassword);
    formData.append('confirm_password', confirmPassword);

    const res = await fetch(`${API_BASE}/api/auth/password`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData,
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || 'Failed to change password');
    }
    return res.json();
  },

  // Products
  async getProducts(params: { skip?: number; limit?: number; search?: string } = {}): Promise<import('./types').PaginatedResponse<import('./types').Product>> {
    const searchParams = new URLSearchParams();
    if (params.skip !== undefined) searchParams.append('skip', String(params.skip));
    if (params.limit !== undefined) searchParams.append('limit', String(params.limit));
    if (params.search) searchParams.append('search', params.search);

    const res = await fetch(`${API_BASE}/api/products?${searchParams}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch products');
    return res.json();
  },

  async getProduct(productId: number): Promise<import('./types').Product> {
    const res = await fetch(`${API_BASE}/api/products/${productId}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch product');
    return res.json();
  },

  async createProduct(product: Omit<import('./types').Product, 'id' | 'created_at'>): Promise<import('./types').Product> {
    const res = await fetch(`${API_BASE}/api/products`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(product),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || 'Failed to create product');
    }
    return res.json();
  },

  async updateProduct(productId: number, product: Omit<import('./types').Product, 'id' | 'created_at'>): Promise<import('./types').Product> {
    const url = `${API_BASE}/api/products/${productId}`;
    console.log('[updateProduct] Starting request to:', url);
    console.log('[updateProduct] Payload:', JSON.stringify(product, null, 2));
    const headers = getHeaders();
    console.log('[updateProduct] Headers being sent:', JSON.stringify(headers));

    let res: Response;
    try {
      res = await fetchWithTimeout(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify(product),
      });
    } catch (err) {
      console.error('[updateProduct] Fetch error:', err);
      throw new Error(`Network error: ${err instanceof Error ? err.message : String(err)}`);
    }

    console.log('[updateProduct] Response status:', res.status, res.statusText);
    if (!res.ok) {
      let errorDetail = 'Unknown error';
      try {
        const errorData = await res.json();
        errorDetail = errorData.detail || JSON.stringify(errorData);
      } catch {
        errorDetail = res.statusText;
      }
      console.error('[updateProduct] Error response:', errorDetail);
      throw new Error(errorDetail);
    }
    return res.json();
  },

  async deleteProduct(productId: number): Promise<void> {
    const res = await fetch(`${API_BASE}/api/products/${productId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || 'Failed to delete product');
    }
  },

  async createProductWithImage(product: { name: string; sku: string; stock_qty: number; description: string }, imageFile: File | null): Promise<import('./types').Product> {
    const token = getToken();
    console.log('[createProductWithImage] Token exists:', !!token);
    if (!token) {
      console.error('[createProductWithImage] No token found in localStorage!');
    }

    const formData = new FormData();
    formData.append('name', product.name);
    formData.append('sku', product.sku);
    formData.append('stock_qty', String(product.stock_qty));
    formData.append('description', product.description || '');
    if (imageFile) {
      formData.append('image', imageFile);
    }

    console.log('[createProductWithImage] Sending request to:', `${API_BASE}/api/products/with-image`);
    const res = await fetch(`${API_BASE}/api/products/with-image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    console.log('[createProductWithImage] Response status:', res.status, res.statusText);
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || 'Failed to create product');
    }
    return res.json();
  },

  async updateProductWithImage(productId: number, product: { name: string; sku: string; stock_qty: number; description: string }, imageFile: File | null, keepExistingImage: boolean): Promise<import('./types').Product> {
    const formData = new FormData();
    formData.append('name', product.name);
    formData.append('sku', product.sku);
    formData.append('stock_qty', String(product.stock_qty));
    formData.append('description', product.description || '');
    formData.append('keep_existing_image', String(keepExistingImage));
    if (imageFile) {
      formData.append('image', imageFile);
    }

    const res = await fetch(`${API_BASE}/api/products/${productId}/with-image`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData,
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || 'Failed to update product');
    }
    return res.json();
  },

  // Orders
  async createOrder(items: import('./types').OrderItem[]): Promise<import('./types').Order> {
    const res = await fetch(`${API_BASE}/api/orders`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ items }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || 'Failed to create order');
    }
    return res.json();
  },

  async getOrders(params: { skip?: number; limit?: number; status?: string; search?: string } = {}): Promise<import('./types').PaginatedResponse<import('./types').Order>> {
    const searchParams = new URLSearchParams();
    if (params.skip !== undefined) searchParams.append('skip', String(params.skip));
    if (params.limit !== undefined) searchParams.append('limit', String(params.limit));
    if (params.status) searchParams.append('status', params.status);
    if (params.search) searchParams.append('search', params.search);

    const url = `${API_BASE}/api/orders?${searchParams}`;
    console.log('[getOrders] Starting request to:', url);
    const headers = getHeaders();
    console.log('[getOrders] Headers:', JSON.stringify(headers));

    let res: Response;
    try {
      res = await fetchWithTimeout(url, { headers }, 15000);
    } catch (err) {
      console.error('[getOrders] Fetch error:', err);
      throw new Error(`Network error: ${err instanceof Error ? err.message : String(err)}`);
    }

    console.log('[getOrders] Response status:', res.status, res.statusText);
    if (!res.ok) {
      let errorDetail = 'Unknown error';
      try {
        const errorData = await res.json();
        errorDetail = errorData.detail || JSON.stringify(errorData);
      } catch {
        errorDetail = res.statusText;
      }
      console.error('[getOrders] Error response:', errorDetail);
      throw new Error(errorDetail);
    }
    return res.json();
  },

  async getOrder(orderId: number): Promise<import('./types').Order> {
    const res = await fetch(`${API_BASE}/api/orders/${orderId}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch order');
    return res.json();
  },

  async cancelOrder(orderId: number): Promise<import('./types').Order> {
    const res = await fetch(`${API_BASE}/api/orders/${orderId}/cancel`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || 'Failed to cancel order');
    }
    return res.json();
  },

  async uploadPayment(orderId: number, file: File): Promise<import('./types').Payment> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/upload/${orderId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData,
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || 'Failed to upload payment');
    }
    return res.json();
  },

  // Admin
  async approveOrder(orderId: number): Promise<import('./types').Order> {
    const res = await fetch(`${API_BASE}/api/admin/orders/${orderId}/approve`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || 'Failed to approve order');
    }
    return res.json();
  },

  async rejectOrder(orderId: number): Promise<import('./types').Order> {
    const res = await fetch(`${API_BASE}/api/admin/orders/${orderId}/reject`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || 'Failed to reject order');
    }
    return res.json();
  },

  async getStats(): Promise<import('./types').Stats> {
    const res = await fetch(`${API_BASE}/api/admin/stats`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch stats');
    return res.json();
  },

  async getMyStats(): Promise<import('./types').Stats> {
    const res = await fetch(`${API_BASE}/api/stats/me`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch stats');
    return res.json();
  },

  async getAllUsers(): Promise<import('./types').User[]> {
    const res = await fetch(`${API_BASE}/api/admin/users`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch users');
    return res.json();
  },
};

export function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

export function getStoredUser(): import('./types').User | null {
  const userStr = localStorage.getItem('user');
  if (userStr) {
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }
  return null;
}

export function getStoredToken(): string | null {
  return localStorage.getItem('token');
}
