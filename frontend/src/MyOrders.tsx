import { useState, useEffect } from 'react';
import { api } from './api';
import type { Order } from './api';

interface MyOrdersProps {
  onViewOrder: (order: Order) => void;
  refreshKey: number;
  isAdmin?: boolean;
}

export function MyOrders({ onViewOrder, refreshKey, isAdmin }: MyOrdersProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingId, setProcessingId] = useState<number | null>(null);

  useEffect(() => {
    loadOrders();
  }, [refreshKey]);

  const loadOrders = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getOrders();
      setOrders([...data.items].reverse());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (orderId: number) => {
    setProcessingId(orderId);
    try {
      await api.approveOrder(orderId);
      loadOrders();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to approve payment');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (orderId: number) => {
    setProcessingId(orderId);
    try {
      await api.rejectOrder(orderId);
      loadOrders();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reject payment');
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusClass = (status: string) => {
    if (status === 'Pending Payment') return 'status-pending';
    if (status === 'Payment Under Review') return 'status-review';
    if (status === 'Payment Rejected') return 'status-cancelled';
    if (status === 'Cancelled') return 'status-cancelled';
    if (status === 'Payment Approved') return 'status-complete';
    return 'status-complete';
  };

  const getStatusIcon = (status: string) => {
    if (status === 'Pending Payment') return '⏳';
    if (status === 'Payment Under Review') return '🔍';
    if (status === 'Payment Rejected') return '❌';
    if (status === 'Cancelled') return '❌';
    if (status === 'Payment Approved') return '✓';
    return '✓';
  };

  const pendingCount = orders.filter(o => o.status === 'Pending Payment').length;
  const reviewCount = orders.filter(o => o.status === 'Payment Under Review').length;
  const approvedCount = orders.filter(o => o.status === 'Payment Approved').length;

  if (loading) return <div className="loading">Loading orders...</div>;
  if (error) return <div className="alert alert-error">{error}</div>;

  return (
    <div className="order-management">
      {/* Stats Row */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-value">{orders.length}</div>
          <div className="stat-label">Total Orders</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{pendingCount}</div>
          <div className="stat-label">Pending Payment</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{reviewCount}</div>
          <div className="stat-label">Under Review</div>
        </div>
        {isAdmin && (
          <div className="stat-card">
            <div className="stat-value">{approvedCount}</div>
            <div className="stat-label">Approved</div>
          </div>
        )}
      </div>

      {/* Orders Table */}
      {orders.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📋</div>
          <p>No orders yet.</p>
          <p>Place an order to see it here!</p>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Order Number</th>
                <th>Date & Time</th>
                <th>Items</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <span className="order-number">{order.order_number}</span>
                  </td>
                  <td>{new Date(order.created_at).toLocaleString()}</td>
                  <td>{order.items.length} item(s)</td>
                  <td>
                    <span className={`status-badge ${getStatusClass(order.status)}`}>
                      {getStatusIcon(order.status)} {order.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => onViewOrder(order)}
                        className="btn btn-secondary btn-sm"
                      >
                        View Details
                      </button>
                      {order.payments && order.payments.length > 0 && (
                        <button
                          onClick={() => onViewOrder(order)}
                          className="btn btn-info btn-sm"
                          style={{ background: 'var(--info)', color: 'white' }}
                        >
                          View Receipt
                        </button>
                      )}
                      {isAdmin && order.status === 'Payment Under Review' && (
                        <>
                          <button
                            onClick={() => handleApprove(order.id)}
                            className="btn btn-success btn-sm"
                            disabled={processingId === order.id}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(order.id)}
                            className="btn btn-danger btn-sm"
                            disabled={processingId === order.id}
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
