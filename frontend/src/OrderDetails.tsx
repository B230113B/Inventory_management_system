import { useState } from 'react';
import { api } from './api';
import type { Order } from './api';

const API_BASE = 'http://localhost:8000';

interface OrderDetailsProps {
  order: Order;
  onClose: () => void;
  onStatusChange?: (orderId: number, newStatus: string) => void;
  isAdmin?: boolean;
}

export function OrderDetails({ order, onClose, onStatusChange, isAdmin }: OrderDetailsProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError('');
    try {
      await api.uploadPayment(order.id, file);
      setUploadSuccess(true);
      onStatusChange?.(order.id, 'Payment Under Review');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleCancelOrder = async () => {
    setCancelling(true);
    setError('');
    try {
      await api.cancelOrder(order.id);
      onStatusChange?.(order.id, 'Cancelled');
      setShowCancelConfirm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to cancel order');
    } finally {
      setCancelling(false);
    }
  };

  const handleApprove = async () => {
    setProcessing(true);
    setError('');
    try {
      await api.approveOrder(order.id);
      onStatusChange?.(order.id, 'Payment Approved');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to approve payment');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    setProcessing(true);
    setError('');
    try {
      await api.rejectOrder(order.id);
      onStatusChange?.(order.id, 'Payment Rejected');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reject payment');
    } finally {
      setProcessing(false);
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <span>📋</span>
            Order {order.order_number}
          </h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Order Meta */}
          <div className="order-meta">
            <div className="order-meta-item">
              <label>Order Number</label>
              <div className="value order-number">{order.order_number}</div>
            </div>
            <div className="order-meta-item">
              <label>Status</label>
              <div className="value">
                <span className={`status-badge ${getStatusClass(order.status)}`}>
                  {order.status}
                </span>
              </div>
            </div>
            <div className="order-meta-item">
              <label>Created</label>
              <div className="value">{new Date(order.created_at).toLocaleString()}</div>
            </div>
            <div className="order-meta-item">
              <label>Total Items</label>
              <div className="value">{order.items.length} item(s)</div>
            </div>
          </div>

          {/* Cancel Warning */}
          {showCancelConfirm && (
            <div className="cancel-warning">
              <div className="icon">⚠️</div>
              <div>
                <p><strong>Cancel this order?</strong></p>
                <p>This will restore the stock quantities for all items in this order. This action cannot be undone.</p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="alert alert-error">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Items Table */}
          <h3 style={{ marginBottom: '12px', fontSize: '15px', color: 'var(--gray-700)' }}>
            Order Items
          </h3>
          {order.items.length === 0 ? (
            <p style={{ color: 'var(--gray-500)', fontStyle: 'italic' }}>No items in this order.</p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.product?.name || 'Unknown'}</td>
                      <td><code>{item.product?.sku || '-'}</code></td>
                      <td>{item.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Payment Upload Section */}
          {order.status === 'Pending Payment' && !uploadSuccess && !showCancelConfirm && (
            <div className="upload-section">
              <h3>📤 Upload Payment Receipt</h3>
              <p>Upload an image or PDF of your payment receipt to proceed with order processing.</p>
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/gif,application/pdf"
                onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                disabled={uploading}
              />
              {uploading && (
                <div className="loading" style={{ padding: '20px' }}>
                  Uploading receipt...
                </div>
              )}
            </div>
          )}

          {/* Payment Receipt Section - Show if receipt uploaded */}
          {(order.status === 'Payment Under Review' || order.status === 'Payment Approved' || order.status === 'Payment Rejected') && order.payments && order.payments.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <h3 style={{ marginBottom: '12px', fontSize: '15px', color: 'var(--gray-700)' }}>
                Payment Receipt
              </h3>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <button
                  onClick={() => setShowReceiptModal(true)}
                  className="btn btn-info btn-sm"
                  style={{ background: 'var(--info)', color: 'white' }}
                >
                  📄 View Receipt
                </button>
                <span style={{ fontSize: '13px', color: 'var(--gray-500)' }}>
                  Uploaded: {new Date(order.payments[0].uploaded_at).toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {/* Admin Payment Review Section */}
          {isAdmin && order.status === 'Payment Under Review' && (
            <div className="admin-review-section" style={{ marginTop: '20px', padding: '20px', background: 'var(--info-light)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--info)' }}>
              <h3 style={{ marginBottom: '12px', fontSize: '15px', color: 'var(--info)' }}>
                🔍 Admin Payment Review
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--gray-700)', marginBottom: '16px' }}>
                Review the uploaded payment receipt and approve or reject the payment.
              </p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={handleApprove}
                  className="btn btn-success"
                  disabled={processing}
                >
                  {processing ? 'Processing...' : '✓ Approve Payment'}
                </button>
                <button
                  onClick={handleReject}
                  className="btn btn-danger"
                  disabled={processing}
                >
                  {processing ? 'Processing...' : '✕ Reject Payment'}
                </button>
              </div>
            </div>
          )}

          {/* Upload Success Message */}
          {uploadSuccess && (
            <div className="alert alert-success">
              <span>✓</span>
              <span>Payment receipt uploaded successfully! Status updated to "Payment Under Review".</span>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {/* Cancel Button - Only for Pending Payment orders */}
          {order.status === 'Pending Payment' && (
            <>
              {!showCancelConfirm ? (
                <button
                  className="btn btn-danger"
                  onClick={() => setShowCancelConfirm(true)}
                >
                  Cancel Order
                </button>
              ) : (
                <>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setShowCancelConfirm(false)}
                    disabled={cancelling}
                  >
                    Keep Order
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={handleCancelOrder}
                    disabled={cancelling}
                  >
                    {cancelling ? 'Cancelling...' : 'Confirm Cancel'}
                  </button>
                </>
              )}
            </>
          )}
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      {/* Receipt Modal */}
      {showReceiptModal && order.payments && order.payments.length > 0 && (
        <div className="modal-overlay" onClick={() => setShowReceiptModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h2>
                <span>📄</span>
                Payment Receipt
              </h2>
              <button className="modal-close" onClick={() => setShowReceiptModal(false)}>×</button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center' }}>
              <img
                src={`${API_BASE}${order.payments[0].file_url}`}
                alt="Payment Receipt"
                style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 'var(--radius)' }}
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowReceiptModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
