import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../contexts/ToastContext';
import type { Product } from '../types';

const API_BASE = 'http://localhost:8000';

const getImageUrl = (imageUrl: string | undefined | null): string => {
  if (!imageUrl) return '';
  if (imageUrl.startsWith('http')) return imageUrl;
  return `${API_BASE}${imageUrl}`;
};

export function ProductsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { showToast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '', sku: '', stock_qty: 10, description: '', image_url: ''
  });
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState({ name: '', sku: '', stock_qty: 0, description: '', image_url: '' });
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const [keepExistingImage, setKeepExistingImage] = useState(true);
  const [editing, setEditing] = useState(false);

  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Order quantity state for Staff
  const [orderQuantities, setOrderQuantities] = useState<Record<number, number>>({});
  const [ordering, setOrdering] = useState<number | null>(null);

  const openLightbox = (imageUrl: string | undefined | null) => {
    if (imageUrl) {
      setLightboxImage(getImageUrl(imageUrl));
    }
  };

  const closeLightbox = () => {
    setLightboxImage(null);
  };

  const loadProducts = useCallback(async (pageNum = 1, searchQuery = search) => {
    setLoading(true);
    setError('');
    try {
      const skip = (pageNum - 1) * 10;
      const data = await api.getProducts({ skip, limit: 10, search: searchQuery || undefined });
      setProducts(data.items);
      setTotalPages(data.total_pages);
      setTotal(data.total);
      setPage(pageNum);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadProducts(1, '');
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadProducts(1, search);
  };

  const handleQuantityChange = (productId: number, quantity: number) => {
    setOrderQuantities(prev => ({ ...prev, [productId]: quantity }));
  };

  const handleQuickOrder = async (product: Product) => {
    const quantity = orderQuantities[product.id] || 1;
    if (quantity <= 0) return;

    setOrdering(product.id);
    try {
      await api.createOrder([{ product_id: product.id, quantity }]);
      showToast(`Added ${quantity} x ${product.name} to order`, 'success');
      setOrderQuantities(prev => ({ ...prev, [product.id]: 0 }));
      // Update stock immediately in local state
      setProducts(prev => prev.map(p =>
        p.id === product.id ? { ...p, stock_qty: p.stock_qty - quantity } : p
      ));
    } catch (err) {
      // Re-fetch product list to show real-time accurate stock
      loadProducts(page, search);
      const errorMsg = err instanceof Error ? err.message : 'Failed to create order';
      showToast(errorMsg, 'error');
    } finally {
      setOrdering(null);
    }
  };

  const handleNewImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setNewImageFile(file);
    if (file) {
      setNewImagePreview(URL.createObjectURL(file));
    } else {
      setNewImagePreview(null);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setError('');
    try {
      const productData = {
        name: newProduct.name,
        sku: newProduct.sku,
        stock_qty: newProduct.stock_qty,
        description: newProduct.description
      };
      await api.createProductWithImage(productData, newImageFile);
      setShowAddForm(false);
      setNewProduct({ name: '', sku: '', stock_qty: 10, description: '', image_url: '' });
      setNewImageFile(null);
      setNewImagePreview(null);
      loadProducts(1, search);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add product');
    } finally {
      setAdding(false);
    }
  };

  const handleEditClick = (product: Product) => {
    setEditingProduct(product);
    setEditForm({
      name: product.name,
      sku: product.sku,
      stock_qty: product.stock_qty,
      description: product.description || '',
      image_url: product.image_url || ''
    });
    setEditImageFile(null);
    setEditImagePreview(null);
    setKeepExistingImage(true);
  };

  const handleEditImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setEditImageFile(file);
    setKeepExistingImage(false);
    if (file) {
      setEditImagePreview(URL.createObjectURL(file));
    } else {
      setEditImagePreview(null);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setEditing(true);
    try {
      const productData = {
        name: editForm.name,
        sku: editForm.sku,
        stock_qty: editForm.stock_qty,
        description: editForm.description
      };
      const updated = await api.updateProductWithImage(editingProduct.id, productData, editImageFile, keepExistingImage);
      setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
      setEditingProduct(null);
      setEditImageFile(null);
      setEditImagePreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update product');
    } finally {
      setEditing(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingProduct) return;
    setDeleting(true);
    try {
      await api.deleteProduct(deletingProduct.id);
      setProducts(prev => prev.filter(p => p.id !== deletingProduct.id));
      setDeletingProduct(null);
      setTotal(prev => prev - 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete product');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="products-page">
      <div className="page-header">
        <div>
          <h1>Product Stock</h1>
          <p>Manage your inventory products</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowAddForm(!showAddForm)} className="btn btn-primary mt-4">
            {showAddForm ? '✕ Cancel' : '+ Add Product'}
          </button>
        )}
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="search-bar">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products by name, SKU, or description..."
        />
        <button type="submit" className="btn btn-primary">Search</button>
        <button type="button" onClick={() => { setSearch(''); loadProducts(1, ''); }} className="btn btn-secondary">
          Clear
        </button>
      </form>

      {/* Add Product Form */}
      {showAddForm && (
        <div className="card add-product-form">
          <div className="card-header">
            <h2>➕ Add New Product</h2>
          </div>
          <div className="card-body">
            <form onSubmit={handleAddProduct}>
              <div className="form-row">
                <div className="form-group">
                  <label>Product Name</label>
                  <input type="text" value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} placeholder="e.g., Premium Widget" required />
                </div>
                <div className="form-group">
                  <label>SKU Code</label>
                  <input type="text" value={newProduct.sku} onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })} placeholder="e.g., SKU-WIDGET-001" required />
                </div>
                <div className="form-group">
                  <label>Stock Quantity</label>
                  <input type="number" min="0" value={newProduct.stock_qty} onChange={(e) => setNewProduct({ ...newProduct, stock_qty: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group" style={{ flex: 2 }}>
                  <label>Description</label>
                  <textarea value={newProduct.description} onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })} placeholder="Product description..." rows={2} />
                </div>
                <div className="form-group">
                  <label>Product Image</label>
                  <input type="file" accept="image/*" onChange={handleNewImageChange} />
                  {newImagePreview && (
                    <img src={newImagePreview} alt="Preview" style={{ marginTop: '8px', maxWidth: '100px', maxHeight: '100px', objectFit: 'cover', borderRadius: '4px' }} />
                  )}
                </div>
              </div>
              {error && <div className="alert alert-error"><span>⚠️</span><span>{error}</span></div>}
              <div className="form-actions">
                <button type="submit" className="btn btn-success" disabled={adding}>{adding ? 'Adding...' : '✓ Add Product'}</button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowAddForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {error && !showAddForm && <div className="alert alert-error"><span>⚠️</span><span>{error}</span></div>}

      {/* Products Table */}
      <div className="card">
        <div className="card-body">
          {loading ? (
            <div className="loading">Loading products...</div>
          ) : products.length === 0 ? (
            <div className="empty-state">
              <div className="icon">📦</div>
              <p>No products found.</p>
            </div>
          ) : (
            <>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Image</th>
                      <th>SKU</th>
                      <th>Product Name</th>
                      <th>Available Stock</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => (
                      <tr key={p.id}>
                        <td>
                          {p.image_url ? (
                            <img
                              src={getImageUrl(p.image_url)}
                              alt={p.name}
                              className="product-thumb-lg clickable-image"
                              onClick={() => openLightbox(p.image_url)}
                            />
                          ) : (
                            <div className="product-thumb-placeholder">📦</div>
                          )}
                        </td>
                        <td><code>{p.sku}</code></td>
                        <td>
                          <div className="product-name-cell">
                            <span className="product-name">{p.name}</span>
                            {p.description && <span className="product-desc">{p.description}</span>}
                          </div>
                        </td>
                        <td className={p.stock_qty < 10 ? 'low-stock' : ''}>
                          {p.stock_qty}
                          {p.stock_qty < 10 && p.stock_qty > 0 && ' (Low)'}
                          {p.stock_qty === 0 && ' (Out of Stock)'}
                        </td>
                        <td>
                          {isAdmin ? (
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button onClick={() => handleEditClick(p)} className="btn btn-secondary btn-sm">Edit</button>
                              <button onClick={() => setDeletingProduct(p)} className="btn btn-danger btn-sm">Delete</button>
                            </div>
                          ) : (
                            <div className="staff-order-actions">
                              <div className="order-input-group">
                                <input
                                  type="number"
                                  min="1"
                                  max={p.stock_qty}
                                  value={orderQuantities[p.id] || 1}
                                  onChange={(e) => handleQuantityChange(p.id, parseInt(e.target.value) || 1)}
                                  disabled={p.stock_qty === 0 || ordering === p.id}
                                  className="order-qty-input"
                                />
                                <button
                                  onClick={() => handleQuickOrder(p)}
                                  disabled={p.stock_qty === 0 || ordering === p.id}
                                  className="btn btn-primary btn-sm"
                                  title="Add to order"
                                >
                                  {ordering === p.id ? '...' : '📦'}
                                </button>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="pagination">
                <span className="pagination-info">
                  Showing {products.length} of {total} products (Page {page} of {totalPages})
                </span>
                <div className="pagination-controls">
                  <button onClick={() => loadProducts(page - 1)} disabled={page <= 1} className="btn btn-secondary btn-sm">← Previous</button>
                  {[...Array(Math.min(totalPages, 5))].map((_, i) => {
                    const pageNum = i + 1;
                    return (
                      <button key={pageNum} onClick={() => loadProducts(pageNum)} className={`btn btn-sm ${page === pageNum ? 'btn-primary' : 'btn-secondary'}`}>
                        {pageNum}
                      </button>
                    );
                  })}
                  <button onClick={() => loadProducts(page + 1)} disabled={page >= totalPages} className="btn btn-secondary btn-sm">Next →</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editingProduct && (
        <div className="modal-overlay" onClick={() => setEditingProduct(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h2>✏️ Edit Product</h2>
              <button className="modal-close" onClick={() => setEditingProduct(null)}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleEditSubmit}>
                <div className="form-group"><label>Product Name</label><input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required /></div>
                <div className="form-group"><label>SKU Code</label><input type="text" value={editForm.sku} onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })} required /></div>
                <div className="form-group"><label>Stock Quantity</label><input type="number" min="0" value={editForm.stock_qty} onChange={(e) => setEditForm({ ...editForm, stock_qty: parseInt(e.target.value) || 0 })} required /></div>
                <div className="form-group"><label>Description</label><textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={3} /></div>
                <div className="form-group">
                  <label>Product Image</label>
                  {editingProduct?.image_url && (
                    <div style={{ marginBottom: '8px' }}>
                      <img
                        src={getImageUrl(editingProduct.image_url)}
                        alt="Current"
                        className="clickable-image"
                        style={{ maxWidth: '100px', maxHeight: '100px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer' }}
                        onClick={() => openLightbox(editingProduct.image_url)}
                      />
                      <span style={{ marginLeft: '8px', fontSize: '12px', color: '#666' }}>Current image (click to enlarge)</span>
                    </div>
                  )}
                  <input type="file" accept="image/*" onChange={handleEditImageChange} />
                  {editImagePreview && (
                    <img src={editImagePreview} alt="Preview" style={{ marginTop: '8px', maxWidth: '100px', maxHeight: '100px', objectFit: 'cover', borderRadius: '4px' }} />
                  )}
                </div>
                {error && <div className="alert alert-error"><span>⚠️</span><span>{error}</span></div>}
                <div className="form-actions">
                  <button type="submit" className="btn btn-success" disabled={editing}>{editing ? 'Saving...' : '✓ Save Changes'}</button>
                  <button type="button" className="btn btn-ghost" onClick={() => setEditingProduct(null)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deletingProduct && (
        <div className="modal-overlay" onClick={() => setDeletingProduct(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h2>⚠️ Delete Product</h2>
              <button className="modal-close" onClick={() => setDeletingProduct(null)}>×</button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete "{deletingProduct.name}"?</p>
              <p style={{ fontSize: '13px', color: 'var(--danger)', marginTop: '8px' }}>This action cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeletingProduct(null)} disabled={deleting}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDeleteConfirm} disabled={deleting}>{deleting ? 'Deleting...' : '✓ Delete'}</button>
            </div>
          </div>
        </div>
      )}

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
