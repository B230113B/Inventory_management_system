import { useState, useEffect } from 'react';
import { api } from './api';
import type { Product } from './api';

interface ProductListProps {
  onAddToCart: (product: Product, qty: number) => void;
  isAdmin: boolean;
  refreshKey: number;
}

export function ProductList({ onAddToCart, isAdmin, refreshKey }: ProductListProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addSuccess, setAddSuccess] = useState('');
  const [newProduct, setNewProduct] = useState({ name: '', sku: '', stock_qty: 10 });

  // Edit modal state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState({ name: '', sku: '', stock_qty: 0 });
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState('');

  // Delete confirmation state
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadProducts();
  }, [refreshKey]);

  const loadProducts = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getProducts();
      setProducts(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setError('');
    setAddSuccess('');
    try {
      const product = await api.createProduct(newProduct);
      // Check if it was an upsert (existing product)
      const exists = products.some(p => p.id === product.id);
      if (exists) {
        setAddSuccess(`Stock incremented! ${product.name} now has ${product.stock_qty} units.`);
        setProducts(prev => prev.map(p => p.id === product.id ? product : p));
      } else {
        setAddSuccess(`Product "${product.name}" added successfully!`);
        setProducts(prev => [...prev, product]);
      }
      setNewProduct({ name: '', sku: '', stock_qty: 10 });
      setShowAddForm(false);
      setTimeout(() => setAddSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add product');
    } finally {
      setAdding(false);
    }
  };

  const handleEditClick = (product: Product) => {
    setEditingProduct(product);
    setEditForm({ name: product.name, sku: product.sku, stock_qty: product.stock_qty });
    setEditError('');
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    setEditing(true);
    setEditError('');
    try {
      const updated = await api.updateProduct(editingProduct.id, editForm);
      setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
      setEditingProduct(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update product');
    } finally {
      setEditing(false);
    }
  };

  const handleDeleteClick = (product: Product) => {
    setDeletingProduct(product);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingProduct) return;

    setDeleting(true);
    try {
      await api.deleteProduct(deletingProduct.id);
      setProducts(prev => prev.filter(p => p.id !== deletingProduct.id));
      setDeletingProduct(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete product');
    } finally {
      setDeleting(false);
    }
  };

  const handleAdd = (product: Product) => {
    const qty = quantities[product.id] || 1;
    onAddToCart(product, qty);
    setQuantities({ ...quantities, [product.id]: 1 });
  };

  if (loading) return <div className="loading">Loading products...</div>;
  if (error) return <div className="alert alert-error">{error}</div>;

  return (
    <div className="product-list">
      {/* Add Product Form - Admin Only */}
      {isAdmin && (
        <>
          <div className="section-header">
            <div></div>
            <div className="header-actions">
              <button
                onClick={loadProducts}
                className="btn btn-secondary btn-sm"
              >
                ↻ Refresh
              </button>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="btn btn-primary btn-sm"
              >
                {showAddForm ? '✕ Cancel' : '+ Add Product'}
              </button>
            </div>
          </div>

          {showAddForm && (
            <div className="add-product-form">
              <h3>➕ Add New Product</h3>
              <form onSubmit={handleAddProduct}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Product Name</label>
                    <input
                      type="text"
                      value={newProduct.name}
                      onChange={e => setNewProduct({ ...newProduct, name: e.target.value })}
                      placeholder="e.g., Premium Widget"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>SKU Code</label>
                    <input
                      type="text"
                      value={newProduct.sku}
                      onChange={e => setNewProduct({ ...newProduct, sku: e.target.value })}
                      placeholder="e.g., SKU-WIDGET-001"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Stock Quantity</label>
                    <input
                      type="number"
                      min="0"
                      value={newProduct.stock_qty}
                      onChange={e => setNewProduct({ ...newProduct, stock_qty: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--gray-500)', marginTop: '8px' }}>
                  Note: If SKU already exists, stock will be incremented.
                </p>
                <div className="form-actions">
                  <button type="submit" className="btn btn-success" disabled={adding}>
                    {adding ? '⏳ Adding...' : '✓ Add Product'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setShowAddForm(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {addSuccess && (
            <div className="alert alert-success" style={{ marginTop: '12px' }}>
              <span>✓</span>
              <span>{addSuccess}</span>
            </div>
          )}
        </>
      )}

      {!isAdmin && (
        <div className="section-header" style={{ borderBottom: 'none', marginBottom: '0', paddingBottom: '0' }}>
          <button onClick={loadProducts} className="btn btn-secondary btn-sm">
            ↻ Refresh
          </button>
        </div>
      )}

      {products.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📦</div>
          <p>No products in stock.</p>
          {isAdmin && <p>Click "Add Product" to get started!</p>}
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product Name</th>
                <th>Available Stock</th>
                {!isAdmin && <th>Quantity</th>}
                {!isAdmin && <th>Action</th>}
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>
                    <code>{p.sku}</code>
                  </td>
                  <td>{p.name}</td>
                  <td className={p.stock_qty < 5 ? 'low-stock' : ''}>
                    {p.stock_qty}
                    {p.stock_qty < 5 && p.stock_qty > 0 && ' (Low)'}
                    {p.stock_qty === 0 && ' (Out of Stock)'}
                  </td>
                  {!isAdmin && (
                    <td>
                      <input
                        type="number"
                        min="1"
                        max={p.stock_qty || 1}
                        value={quantities[p.id] || 1}
                        onChange={(e) => setQuantities({ ...quantities, [p.id]: parseInt(e.target.value) || 1 })}
                        disabled={p.stock_qty === 0}
                      />
                    </td>
                  )}
                  {!isAdmin && (
                    <td>
                      <button
                        onClick={() => handleAdd(p)}
                        disabled={p.stock_qty === 0}
                        className="btn btn-primary btn-sm"
                      >
                        Add to Cart
                      </button>
                    </td>
                  )}
                  {isAdmin && (
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleEditClick(p)}
                          className="btn btn-secondary btn-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteClick(p)}
                          className="btn btn-danger btn-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Product Modal */}
      {editingProduct && (
        <div className="modal-overlay" onClick={() => setEditingProduct(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2>
                <span>✏️</span>
                Edit Product
              </h2>
              <button className="modal-close" onClick={() => setEditingProduct(null)}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleEditSubmit}>
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label>Product Name</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                    required
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius)', fontSize: '14px' }}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label>SKU Code</label>
                  <input
                    type="text"
                    value={editForm.sku}
                    onChange={e => setEditForm({ ...editForm, sku: e.target.value })}
                    required
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius)', fontSize: '14px' }}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label>Stock Quantity</label>
                  <input
                    type="number"
                    min="0"
                    value={editForm.stock_qty}
                    onChange={e => setEditForm({ ...editForm, stock_qty: parseInt(e.target.value) || 0 })}
                    required
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius)', fontSize: '14px' }}
                  />
                </div>
                {editError && (
                  <div className="alert alert-error" style={{ marginBottom: '16px' }}>
                    <span>⚠️</span>
                    <span>{editError}</span>
                  </div>
                )}
                <div className="form-actions">
                  <button type="submit" className="btn btn-success" disabled={editing}>
                    {editing ? '⏳ Saving...' : '✓ Save Changes'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setEditingProduct(null)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingProduct && (
        <div className="modal-overlay" onClick={() => setDeletingProduct(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h2>
                <span>⚠️</span>
                Delete Product
              </h2>
              <button className="modal-close" onClick={() => setDeletingProduct(null)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '16px', color: 'var(--gray-700)' }}>
                Are you sure you want to delete this product?
              </p>
              <div style={{ background: 'var(--gray-50)', padding: '16px', borderRadius: 'var(--radius)', marginBottom: '16px' }}>
                <p><strong>{deletingProduct.name}</strong></p>
                <p style={{ fontSize: '13px', color: 'var(--gray-500)' }}>
                  SKU: {deletingProduct.sku} | Stock: {deletingProduct.stock_qty}
                </p>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--danger)', fontWeight: '500' }}>
                This action cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setDeletingProduct(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleDeleteConfirm}
                disabled={deleting}
              >
                {deleting ? '⏳ Deleting...' : '✓ Delete Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
