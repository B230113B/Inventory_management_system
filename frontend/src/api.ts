const API_BASE = 'http://localhost:8000';

export interface Product {
  id: number;
  name: string;
  sku: string;
  stock_qty: number;
}

export interface OrderItem {
  product_id: number;
  quantity: number;
}

export interface Order {
  id: number;
  order_number: string;
  status: string;
  created_at: string;
  items: OrderItemWithProduct[];
  payments: Payment[];
}

export interface OrderItemWithProduct {
  id: number;
  product_id: number;
  quantity: number;
  product?: Product;
}

export interface Payment {
  id: number;
  order_id: number;
  file_url: string;
  uploaded_at: string;
}

export const api = {
  async getProducts(): Promise<Product[]> {
    const res = await fetch(`${API_BASE}/products`);
    if (!res.ok) throw new Error('Failed to fetch products');
    return res.json();
  },

  async createProduct(product: { name: string; sku: string; stock_qty: number }): Promise<Product> {
    const res = await fetch(`${API_BASE}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || 'Failed to create product');
    }
    return res.json();
  },

  async updateProduct(productId: number, product: { name: string; sku: string; stock_qty: number }): Promise<Product> {
    const res = await fetch(`${API_BASE}/products/${productId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || 'Failed to update product');
    }
    return res.json();
  },

  async deleteProduct(productId: number): Promise<void> {
    const res = await fetch(`${API_BASE}/products/${productId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || 'Failed to delete product');
    }
  },

  async createOrder(items: OrderItem[]): Promise<Order> {
    const res = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || 'Failed to create order');
    }
    return res.json();
  },

  async getOrders(): Promise<Order[]> {
    const res = await fetch(`${API_BASE}/orders`);
    if (!res.ok) throw new Error('Failed to fetch orders');
    return res.json();
  },

  async getOrder(orderId: number): Promise<Order> {
    const res = await fetch(`${API_BASE}/orders/${orderId}`);
    if (!res.ok) throw new Error('Failed to fetch order');
    return res.json();
  },

  async cancelOrder(orderId: number): Promise<Order> {
    const res = await fetch(`${API_BASE}/orders/${orderId}/cancel`, {
      method: 'POST',
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || 'Failed to cancel order');
    }
    return res.json();
  },

  async uploadPayment(orderId: number, file: File): Promise<void> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/upload/${orderId}`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || 'Failed to upload payment');
    }
  },

  async approvePayment(orderId: number): Promise<Order> {
    const res = await fetch(`${API_BASE}/payments/${orderId}/approve`, {
      method: 'POST',
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || 'Failed to approve payment');
    }
    return res.json();
  },

  async rejectPayment(orderId: number): Promise<Order> {
    const res = await fetch(`${API_BASE}/payments/${orderId}/reject`, {
      method: 'POST',
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || 'Failed to reject payment');
    }
    return res.json();
  },
};
