export interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'staff';
  is_active: boolean;
  created_at: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

export interface Product {
  id: number;
  name: string;
  sku: string;
  stock_qty: number;
  description?: string;
  image_url?: string;
  created_at?: string;
}

export interface OrderItem {
  product_id: number;
  quantity: number;
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

export interface Order {
  id: number;
  order_number: string;
  status: string;
  user_id?: number;
  created_at: string;
  items: OrderItemWithProduct[];
  payments: Payment[];
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface Stats {
  total_products: number;
  available_products: number;
  total_orders: number;
  pending_orders: number;
  approved_orders: number;
  rejected_orders: number;
  cancelled_orders: number;
  total_revenue: number;
}
