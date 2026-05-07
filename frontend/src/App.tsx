import { useState, useEffect, useCallback } from 'react';
import { ProductList } from './ProductList';
import { Cart } from './Cart';
import { OrderDetails } from './OrderDetails';
import { MyOrders } from './MyOrders';
import { api } from './api';
import type { Product, Order } from './api';
import './App.css';

type UserRole = 'admin' | 'counter';

const ADMIN_PASSWORD = 'admin123';

function App() {
  const [cartItems, setCartItems] = useState<{ product: Product; quantity: number }[]>([]);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [placing, setPlacing] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [userRole, setUserRole] = useState<UserRole>('counter');
  const [refreshKey, setRefreshKey] = useState(0);
  const [showAdminGate, setShowAdminGate] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPasswordError, setAdminPasswordError] = useState('');

  const refreshData = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  const handleAdminClick = () => {
    setShowAdminGate(true);
    setAdminPassword('');
    setAdminPasswordError('');
  };

  const handleAdminPasswordSubmit = () => {
    if (adminPassword === ADMIN_PASSWORD) {
      setUserRole('admin');
      setShowAdminGate(false);
      setAdminPassword('');
      setAdminPasswordError('');
    } else {
      setAdminPasswordError('Incorrect password. Please try again.');
    }
  };

  const handleAdminPasswordKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAdminPasswordSubmit();
    }
  };

  const handleCounterClick = () => {
    setUserRole('counter');
    setShowAdminGate(false);
  };

  const handleAddToCart = (product: Product, quantity: number) => {
    setOrderError('');
    setCartItems(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { product, quantity }];
    });
  };

  const handleRemoveFromCart = (productId: number) => {
    setOrderError('');
    setCartItems(prev => prev.filter(item => item.product.id !== productId));
  };

  const handlePlaceOrder = async () => {
    setPlacing(true);
    setOrderError('');
    try {
      const items = cartItems.map(item => ({
        product_id: item.product.id,
        quantity: item.quantity,
      }));
      const order = await api.createOrder(items);
      setCartItems([]);
      setCurrentOrder(order);
      refreshData();
    } catch (e) {
      setOrderError(e instanceof Error ? e.message : 'Failed to place order');
    } finally {
      setPlacing(false);
    }
  };

  const handleViewOrder = async (order: Order) => {
    try {
      const freshOrder = await api.getOrder(order.id);
      setCurrentOrder(freshOrder);
    } catch (e) {
      setCurrentOrder(order);
    }
  };

  const handleCloseOrderDetails = () => {
    setCurrentOrder(null);
  };

  const handleStatusChange = (orderId: number, newStatus: string) => {
    if (currentOrder && currentOrder.id === orderId) {
      setCurrentOrder({ ...currentOrder, status: newStatus });
    }
    refreshData();
  };

  return (
    <div className="app">
      {/* Navigation Bar */}
      <nav className="navbar">
        <div className="navbar-content">
          <div className="navbar-brand">
            <div className="logo">IM</div>
            <h1>Inventory Management System</h1>
          </div>

          <div className="navbar-actions">
            {/* Role Toggle */}
            <div className="role-toggle">
              <button
                className={`role-btn ${userRole === 'admin' ? 'active' : ''}`}
                onClick={handleAdminClick}
              >
                Admin
                {userRole === 'admin' && <span className="badge">✓</span>}
              </button>
              <button
                className={`role-btn ${userRole === 'counter' ? 'active' : ''}`}
                onClick={handleCounterClick}
              >
                Counter Staff
                {userRole === 'counter' && <span className="badge">✓</span>}
              </button>
            </div>

            {/* User Info */}
            <div className="user-info">
              <div className="avatar">
                {userRole === 'admin' ? 'A' : 'CS'}
              </div>
              <span>
                {userRole === 'admin' ? 'Administrator' : 'Counter Staff'}
              </span>
            </div>
          </div>
        </div>
      </nav>

      <main>
        {orderError && (
          <div className="alert alert-error">
            <span>⚠️</span>
            <span>{orderError}</span>
            <button className="alert-close" onClick={() => setOrderError('')}>×</button>
          </div>
        )}

        {/* Product Stock Card - Full width for Admin, grid for Counter Staff */}
        {userRole === 'admin' ? (
          <div className="card full-width" style={{ marginBottom: '24px' }}>
            <div className="card-header">
              <h2>
                <span className="icon">📦</span>
                Product Stock
              </h2>
            </div>
            <div className="card-body">
              <ProductList
                onAddToCart={handleAddToCart}
                isAdmin={true}
                refreshKey={refreshKey}
              />
            </div>
          </div>
        ) : (
          <div className="dashboard-grid">
            {/* Product Stock Card */}
            <div className="card">
              <div className="card-header">
                <h2>
                  <span className="icon">📦</span>
                  Product Stock
                </h2>
              </div>
              <div className="card-body">
                <ProductList
                  onAddToCart={handleAddToCart}
                  isAdmin={false}
                  refreshKey={refreshKey}
                />
              </div>
            </div>

            {/* Cart Card */}
            <div className="card">
              <div className="card-header">
                <h2>
                  <span className="icon">🛒</span>
                  Shopping Cart
                </h2>
              </div>
              <div className="card-body">
                <Cart
                  items={cartItems}
                  onRemove={handleRemoveFromCart}
                  onPlaceOrder={handlePlaceOrder}
                  placing={placing}
                />
              </div>
            </div>
          </div>
        )}

        {/* Order Management Section */}
        <div className="card full-width">
          <div className="card-header">
            <h2>
              <span className="icon">📋</span>
              Order Management
            </h2>
          </div>
          <div className="card-body">
            <MyOrders
              onViewOrder={handleViewOrder}
              refreshKey={refreshKey}
              isAdmin={userRole === 'admin'}
            />
          </div>
        </div>
      </main>

      {currentOrder && (
        <OrderDetails
          order={currentOrder}
          onClose={handleCloseOrderDetails}
          onStatusChange={handleStatusChange}
          isAdmin={userRole === 'admin'}
        />
      )}

      {/* Admin Password Gate Modal */}
      {showAdminGate && (
        <div className="modal-overlay" onClick={() => setShowAdminGate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h2>
                <span>🔐</span>
                Admin Access
              </h2>
              <button className="modal-close" onClick={() => setShowAdminGate(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '20px', color: 'var(--gray-600)', fontSize: '14px' }}>
                Please enter the admin password to access the Admin panel.
              </p>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: 'var(--gray-700)' }}>
                  Password
                </label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={e => setAdminPassword(e.target.value)}
                  onKeyDown={handleAdminPasswordKeyDown}
                  placeholder="Enter admin password"
                  autoFocus
                  style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius)', fontSize: '14px' }}
                />
              </div>
              {adminPasswordError && (
                <div className="alert alert-error" style={{ marginBottom: '16px' }}>
                  <span>⚠️</span>
                  <span>{adminPasswordError}</span>
                </div>
              )}
              <p style={{ fontSize: '12px', color: 'var(--gray-500)', fontStyle: 'italic' }}>
                Testing Hint: admin123
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAdminGate(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleAdminPasswordSubmit}>
                Access Admin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
