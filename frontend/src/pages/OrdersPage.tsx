import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../contexts/ToastContext';
import type { Order } from '../types';

const API_BASE = 'http://localhost:8000';

const getImageUrl = (imageUrl: string | undefined | null): string => {
  if (!imageUrl) return '';
  if (imageUrl.startsWith('http')) return imageUrl;
  return `${API_BASE}${imageUrl}`;
};

const STATUS_TABS = [
  { key: '', label: 'All Orders', icon: '📋' },
  { key: 'Pending Payment', label: 'Pending', icon: '⏳' },
  { key: 'Payment Under Review', label: 'Under Review', icon: '🔍' },
  { key: 'Payment Approved', label: 'Approved', icon: '✅' },
  { key: 'Payment Rejected', label: 'Rejected', icon: '❌' },
  { key: 'Cancelled', label: 'Cancelled', icon: '🚫' },
];

export function OrdersPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { showToast } = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('');

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    review: 0,
    approved: 0,
    rejected: 0,
    cancelled: 0,
  });

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [pageInput, setPageInput] = useState('');

  const loadOrders = useCallback(async (pageNum = 1, searchQuery = '') => {
    setLoading(true);
    setError('');
    const skip = (pageNum - 1) * 10;
    try {
      const data = await api.getOrders({
        skip,
        limit: 10,
        status: activeTab || undefined,
        search: searchQuery || undefined,
      });
      setOrders(data.items);
      setTotalPages(data.total_pages);
      setTotal(data.total);
      setPage(pageNum);

      // Load stats for tabs (use higher limit to get accurate counts)
      const [allData, pendingData, reviewData, approvedData, rejectedData, cancelledData] = await Promise.all([
        api.getOrders({ limit: 1 }),
        api.getOrders({ limit: 1, status: 'Pending Payment' }),
        api.getOrders({ limit: 1, status: 'Payment Under Review' }),
        api.getOrders({ limit: 1, status: 'Payment Approved' }),
        api.getOrders({ limit: 1, status: 'Payment Rejected' }),
        api.getOrders({ limit: 1, status: 'Cancelled' }),
      ]);
      setStats({
        total: allData.total,
        pending: pendingData.total,
        review: reviewData.total,
        approved: approvedData.total,
        rejected: rejectedData.total,
        cancelled: cancelledData.total,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadOrders();
  }, [activeTab]);

  // Auto-open order from sessionStorage (e.g., from Dashboard click)
  useEffect(() => {
    const orderId = sessionStorage.getItem('selectedOrderId');
    if (orderId && orders.length > 0) {
      const order = orders.find(o => o.id === parseInt(orderId));
      if (order) {
        openDrawer(order);
      }
      sessionStorage.removeItem('selectedOrderId');
    }
  }, [orders]);

  const handleTabClick = (status: string) => {
    setActiveTab(status);
  };

  const openDrawer = async (order: Order) => {
    try {
      const freshOrder = await api.getOrder(order.id);
      setSelectedOrder(freshOrder);
    } catch {
      setSelectedOrder(order);
    }
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedOrder(null);
  };

  const openLightbox = (imageUrl: string) => {
    setLightboxImage(imageUrl);
  };

  const closeLightbox = () => {
    setLightboxImage(null);
  };

  const handleApprove = async () => {
    if (!selectedOrder) return;
    setProcessingId(selectedOrder.id);
    try {
      const updated = await api.approveOrder(selectedOrder.id);
      setSelectedOrder(updated);
      setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
      showToast('Order approved successfully', 'success');
      // Refresh stats
      loadOrders(page, search);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to approve', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!selectedOrder) return;
    setProcessingId(selectedOrder.id);
    try {
      const updated = await api.rejectOrder(selectedOrder.id);
      setSelectedOrder(updated);
      setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
      showToast('Order rejected', 'info');
      // Refresh stats
      loadOrders(page, search);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to reject', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleCancel = async () => {
    if (!selectedOrder) return;
    if (!confirm('Are you sure you want to cancel this order?')) return;
    setProcessingId(selectedOrder.id);
    try {
      const updated = await api.cancelOrder(selectedOrder.id);
      setSelectedOrder(updated);
      setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
      showToast('Order cancelled', 'info');
      // Refresh stats
      loadOrders(page, search);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to cancel order', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedOrder || !uploadFile) return;
    setUploading(true);
    try {
      await api.uploadPayment(selectedOrder.id, uploadFile);
      const freshOrder = await api.getOrder(selectedOrder.id);
      setSelectedOrder(freshOrder);
      setOrders(prev => prev.map(o => o.id === freshOrder.id ? freshOrder : o));
      setUploadFile(null);
      showToast('Receipt uploaded successfully', 'success');
      // Refresh stats
      loadOrders(page, search);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to upload payment', 'error');
    } finally {
      setUploading(false);
    }
  };

  const getStatusClass = (status: string) => {
    if (status === 'Pending Payment') return 'status-pending';
    if (status === 'Payment Under Review') return 'status-review';
    if (status === 'Payment Rejected' || status === 'Cancelled') return 'status-cancelled';
    if (status === 'Payment Approved') return 'status-complete';
    return '';
  };

  const getStatusCount = (key: string) => {
    if (key === '') return stats.total;
    if (key === 'Pending Payment') return stats.pending;
    if (key === 'Payment Under Review') return stats.review;
    if (key === 'Payment Approved') return stats.approved;
    if (key === 'Payment Rejected') return stats.rejected;
    if (key === 'Cancelled') return stats.cancelled;
    return 0;
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadOrders(1, search);
  };

  return (
    <div className="orders-page">
      <div className="page-header">
        <div>
          <h1>Order Management</h1>
          <p>View and manage your orders</p>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="status-tabs">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabClick(tab.key)}
            className={`status-tab ${activeTab === tab.key ? 'active' : ''}`}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
            <span className="tab-count">{getStatusCount(tab.key)}</span>
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="search-bar">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by order number or status..."
        />
        <button type="submit" className="btn btn-primary">Search</button>
        <button type="button" onClick={() => { setSearch(''); loadOrders(1, ''); }} className="btn btn-secondary">
          Clear
        </button>
      </form>

      {error && <div className="alert alert-error"><span>⚠️</span><span>{error}</span></div>}

      {/* Orders Table */}
      <div className="card">
        <div className="card-body">
          {loading ? (
            <div className="loading">Loading orders...</div>
          ) : orders.length === 0 ? (
            <div className="empty-state">
              <div className="icon">📋</div>
              <p>No orders found.</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Order Number</th>
                    <th>Date</th>
                    <th>Items</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="clickable-row" onClick={() => openDrawer(order)}>
                      <td><span className="order-number">{order.order_number}</span></td>
                      <td>{new Date(order.created_at).toLocaleString()}</td>
                      <td>{order.items.length} item(s)</td>
                      <td>
                        <span className={`status-badge ${getStatusClass(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDrawer(order);
                          }}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="pagination">
                <span className="pagination-info">
                  Showing {orders.length} of {total} orders (Page {page} of {totalPages})
                </span>
                <div className="pagination-controls">
                  <button onClick={() => loadOrders(page - 1, search)} disabled={page <= 1} className="btn btn-secondary btn-sm">← Previous</button>
                  {[...Array(Math.min(totalPages, 5))].map((_, i) => {
                    const pageNum = i + 1;
                    return (
                      <button key={pageNum} onClick={() => loadOrders(pageNum, search)} className={`btn btn-sm ${page === pageNum ? 'btn-primary' : 'btn-secondary'}`}>
                        {pageNum}
                      </button>
                    );
                  })}
                  <button onClick={() => loadOrders(page + 1, search)} disabled={page >= totalPages} className="btn btn-secondary btn-sm">Next →</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail Drawer */}
      <div className={`drawer-overlay ${drawerOpen ? 'open' : ''}`} onClick={closeDrawer} />
      <div className={`drawer ${drawerOpen ? 'open' : ''}`}>
        {selectedOrder && (
          <>
            <div className="drawer-header">
              <h2>Order Details</h2>
              <button className="modal-close" onClick={closeDrawer}>×</button>
            </div>

            <div className="drawer-body">
              {/* Order Meta */}
              <div className="order-meta">
                <div className="order-meta-item">
                  <label>Order Number</label>
                  <div className="value">
                    <span className="order-number">{selectedOrder.order_number}</span>
                  </div>
                </div>
                <div className="order-meta-item">
                  <label>Status</label>
                  <div className="value">
                    <span className={`status-badge ${getStatusClass(selectedOrder.status)}`}>
                      {selectedOrder.status}
                    </span>
                  </div>
                </div>
                <div className="order-meta-item">
                  <label>Created</label>
                  <div className="value">{new Date(selectedOrder.created_at).toLocaleString()}</div>
                </div>
              </div>

              {/* Order Items */}
              <h3>Order Items</h3>
              <div className="order-items-list">
                {selectedOrder.items.map((item) => (
                  <div key={item.id} className="order-item">
                    <div className="item-info">
                      {item.product?.image_url && (
                        <img src={getImageUrl(item.product?.image_url)} alt="" className="item-thumb" />
                      )}
                      <div>
                        <span className="item-name">{item.product?.name || 'Unknown Product'}</span>
                        <span className="item-sku">{item.product?.sku}</span>
                      </div>
                    </div>
                    <span className="item-qty">x{item.quantity}</span>
                  </div>
                ))}
              </div>

              {/* Payment Receipt */}
              {selectedOrder.payments && selectedOrder.payments.length > 0 && (
                <>
                  <h3>Payment Receipt</h3>
                  <div className="receipt-image-container">
                    <img
                      src={`http://localhost:8000${selectedOrder.payments[0].file_url}`}
                      alt="Payment Receipt"
                      className="receipt-image clickable-image"
                      onClick={() => openLightbox(`http://localhost:8000${selectedOrder.payments[0].file_url}`)}
                    />
                  </div>
                </>
              )}

              {/* Upload Payment */}
              {selectedOrder.status === 'Pending Payment' && !isAdmin && (
                <div className="upload-section">
                  <h3>📤 Upload Payment Receipt</h3>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  />
                  <div className="upload-actions">
                    <button
                      onClick={handleUpload}
                      className="btn btn-primary"
                      disabled={!uploadFile || uploading}
                    >
                      {uploading ? 'Uploading...' : 'Upload Receipt'}
                    </button>
                    <button
                      onClick={handleCancel}
                      className="btn btn-danger"
                      disabled={processingId === selectedOrder.id}
                    >
                      {processingId === selectedOrder.id ? 'Cancelling...' : 'Cancel Order'}
                    </button>
                  </div>
                </div>
              )}

              {/* Admin Actions */}
              {isAdmin && selectedOrder.status === 'Payment Under Review' && (
                <div className="admin-actions">
                  <h3>Admin Actions</h3>
                  <p style={{ marginBottom: '12px', color: 'var(--gray-600)' }}>
                    Review the payment receipt above and approve or reject this order.
                  </p>
                  <div className="action-buttons">
                    <button
                      onClick={handleApprove}
                      className="btn btn-success"
                      disabled={processingId === selectedOrder.id}
                    >
                      {processingId === selectedOrder.id ? 'Processing...' : '✓ Approve Payment'}
                    </button>
                    <button
                      onClick={handleReject}
                      className="btn btn-danger"
                      disabled={processingId === selectedOrder.id}
                    >
                      ✗ Reject Payment
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Image Lightbox Modal */}
      {lightboxImage && (
        <div className="lightbox-overlay" onClick={closeLightbox}>
          <div className="lightbox-content" onClick={e => e.stopPropagation()}>
            <button className="lightbox-close" onClick={closeLightbox}>×</button>
            <img src={lightboxImage} alt="Enlarged view" className="lightbox-image" />
          </div>
        </div>
      )}
    </div>
  );
}
