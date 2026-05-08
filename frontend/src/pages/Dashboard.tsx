import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import type { Product, Order } from '../types';

const API_BASE = 'http://localhost:8000';

const getImageUrl = (imageUrl: string | undefined | null): string => {
  if (!imageUrl) return '';
  if (imageUrl.startsWith('http')) return imageUrl;
  return `${API_BASE}${imageUrl}`;
};

export function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [recentProducts, setRecentProducts] = useState<Product[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    loadDashboardData();
  }, [isAdmin]);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const statsData = isAdmin
        ? await api.getStats()
        : await api.getMyStats();
      const prodsData = await api.getProducts({ limit: 5, skip: 0 });
      const ordersData = await api.getOrders({ limit: 5 });

      setStats(statsData);
      setRecentProducts(prodsData.items);
      setRecentOrders(ordersData.items);
    } catch (e) {
      console.error('Failed to load dashboard data', e);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <h1>Welcome back, {user?.username}</h1>
        <p>Here's an overview of your inventory management system.</p>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📦</div>
          <div className="stat-content">
            <span className="stat-value">{stats?.available_products || 0}</span>
            <span className="stat-label">Available Products</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📋</div>
          <div className="stat-content">
            <span className="stat-value">{stats?.total_orders || 0}</span>
            <span className="stat-label">My Orders</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⏳</div>
          <div className="stat-content">
            <span className="stat-value">{stats?.pending_orders || 0}</span>
            <span className="stat-label">Pending Payment</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <span className="stat-value">{stats?.approved_orders || 0}</span>
            <span className="stat-label">Approved Orders</span>
          </div>
        </div>
        {isAdmin && (
          <div className="stat-card">
            <div className="stat-icon">🚫</div>
            <div className="stat-content">
              <span className="stat-value">{stats?.cancelled_orders || 0}</span>
              <span className="stat-label">Cancelled Orders</span>
            </div>
          </div>
        )}
      </div>

      <div className="dashboard-grid">
        {/* Recent Products */}
        <div className="card">
          <div className="card-header">
            <h2><span className="icon">📦</span> Recent Products</h2>
          </div>
          <div className="card-body">
            {recentProducts.length === 0 ? (
              <div className="empty-state">
                <p>No products found.</p>
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>SKU</th>
                      <th>Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentProducts.map((product) => (
                      <tr
                        key={product.id}
                        className="clickable-row"
                        onClick={() => navigate('/products')}
                        title="View in Product Stock"
                      >
                        <td>
                          <div className="product-cell">
                            {product.image_url && (
                              <img src={getImageUrl(product.image_url)} alt="" className="product-thumb" />
                            )}
                            <span>{product.name}</span>
                          </div>
                        </td>
                        <td><code>{product.sku}</code></td>
                        <td className={product.stock_qty < 10 ? 'low-stock' : ''}>
                          {product.stock_qty}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Recent Orders */}
        <div className="card">
          <div className="card-header">
            <h2><span className="icon">📋</span> Recent Orders</h2>
          </div>
          <div className="card-body">
            {recentOrders.length === 0 ? (
              <div className="empty-state">
                <p>No orders yet.</p>
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Order #</th>
                      <th>Items</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map((order) => (
                      <tr
                        key={order.id}
                        className="clickable-row"
                        onClick={() => {
                          navigate('/orders');
                          // Store selected order for Order Management to open
                          sessionStorage.setItem('selectedOrderId', String(order.id));
                        }}
                        title="Click to view in Order Management"
                      >
                        <td><span className="order-number">{order.order_number}</span></td>
                        <td>{order.items.length} item(s)</td>
                        <td>
                          <span className={`status-badge ${getStatusClass(order.status)}`}>
                            {order.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getStatusClass(status: string) {
  if (status === 'Pending Payment') return 'status-pending';
  if (status === 'Payment Under Review') return 'status-review';
  if (status === 'Payment Rejected' || status === 'Cancelled') return 'status-cancelled';
  if (status === 'Payment Approved') return 'status-complete';
  return '';
}
