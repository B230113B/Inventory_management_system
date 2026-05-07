import type { Product } from './api';

interface CartProps {
  items: { product: Product; quantity: number }[];
  onRemove: (productId: number) => void;
  onPlaceOrder: () => void;
  placing: boolean;
}

export function Cart({ items, onRemove, onPlaceOrder, placing }: CartProps) {
  const total = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="cart">
      {items.length === 0 ? (
        <div className="empty-state">
          <div className="icon">🛒</div>
          <p>Your cart is empty</p>
          <p>Add products from the stock list</p>
        </div>
      ) : (
        <>
          <div className="cart-summary">
            <span className="total">
              <span className="count">{total}</span> item(s) in cart
            </span>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.product.id}>
                    <td>{item.product.name}</td>
                    <td>
                      <strong>{item.quantity}</strong>
                    </td>
                    <td>
                      <button
                        onClick={() => onRemove(item.product.id)}
                        className="btn btn-danger btn-sm"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            className="btn btn-success btn-lg btn-block"
            onClick={onPlaceOrder}
            disabled={placing || items.length === 0}
            style={{ marginTop: '16px' }}
          >
            {placing ? '⏳ Processing Order...' : '✓ Checkout'}
          </button>
        </>
      )}
    </div>
  );
}
