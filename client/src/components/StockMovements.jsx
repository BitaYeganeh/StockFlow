import { useState, useEffect } from 'react';
import { api } from '../services/api';
import Notice from './Notice';

export default function StockMovements({ isLoggedIn, onStockUpdate }) {
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    product_id: '',
    quantity: '',
    movement_type: 'in',
    reason: '',
    notes: '',
  });

  const [message, setMessage] = useState(null);

  // =========================
  // Fetch movements
  // =========================
  const fetchMovements = () => {
    setLoading(true);
    setError(null);

    api.getStockMovements()
      .then(data => {
        const arr = Array.isArray(data)
          ? data
          : (data.data && Array.isArray(data.data) ? data.data : []);

        setMovements(arr);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  // =========================
  // Fetch products
  // =========================
  const fetchProducts = async () => {
    try {
      const data = await api.getProducts();

      const arr = Array.isArray(data)
        ? data
        : (data.data && Array.isArray(data.data) ? data.data : []);

      setProducts(arr);
    } catch (err) {
      setMessage({ type: 'error', text: `Couldn't load the product list. ${err.message}` });
    }
  };

  useEffect(() => {
    // Movements are a protected endpoint — don't call it when signed out
    if (!isLoggedIn) {
      setLoading(false);
      return;
    }
    fetchMovements();
    fetchProducts();
  }, [isLoggedIn]);

  const handleChange = e =>
    setForm({ ...form, [e.target.name]: e.target.value });

  // =========================
  // SUBMIT
  // =========================
  const handleSubmit = async e => {
    e.preventDefault();
    setMessage(null);

    if (!form.product_id || !form.quantity) return;

    try {
      const product = products.find(p => p.id === form.product_id);
      const qty = parseInt(form.quantity);

      if (!product) throw new Error('Product not found');

      const result = await api.createStockMovement({
        product_id: product.id,
        quantity: qty,
        movement_type: form.movement_type,
        reason: form.reason,
        notes: form.notes,
      });

      // =========================
      // Update movements instantly
      // =========================
      setMovements(prev => [{
        id: Date.now(),
        product_id: product.id,
        product_name: product.name,
        sku: product.sku,
        quantity: qty,
        movement_type: form.movement_type,
        reason: form.reason,
        created_date: 'Just now',
        created_ago: 'Just now',
      }, ...prev]);

      // =========================
      // Update dropdown instantly
      // =========================
      if (result?.new_quantity !== undefined) {
        setProducts(prev =>
          prev.map(p =>
            p.id === product.id
              ? { ...p, stock_quantity: result.new_quantity }
              : p
          )
        );
      }

      // =========================
      // Update parent (ProductList)
      // =========================
      if (onStockUpdate && result?.new_quantity !== undefined) {
        onStockUpdate(product.id, result.new_quantity);
      }

      // =========================
      // Custom action message 🔥
      // =========================
      const actionText =
        form.movement_type === 'in'
          ? 'increased'
          : form.movement_type === 'out'
          ? 'decreased'
          : 'adjusted';

      setMessage({
        type: 'success',
        text: `Product "${product.name}" stock ${actionText} (new qty: ${result.new_quantity})`
      });

      // =========================
      // Sync with backend
      // =========================
      setTimeout(() => {
        fetchProducts();
        fetchMovements();
      }, 5000);

      // Reset form
      setForm({
        product_id: '',
        quantity: '',
        movement_type: 'in',
        reason: '',
        notes: '',
      });

    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const typeColors = {
    in: '#44bb44',
    out: '#cc4444',
    adjustment: '#4488ff'
  };

  if (!isLoggedIn) {
    return (
      <div>
        <h2 className="rainbow-text-title">Stock Movements</h2>
        <Notice type="info">
          Sign in with Google (top right) to view and record stock movements.
        </Notice>
      </div>
    );
  }

  return (
    <div>
      <h2 className="rainbow-text-title">Stock Movements</h2>

      {/* =========================
          MESSAGE BOX
      ========================= */}
      {message && (
        <Notice type={message.type} onClose={() => setMessage(null)}>
          {message.text}
        </Notice>
      )}

      {/* =========================
          FORM
      ========================= */}
      <div style={{
        marginBottom: '20px',
        padding: '15px',
        border: '1px solid #444',
        borderRadius: '8px'
      }}>
        <h3>Record Movement</h3>

        <form
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            alignItems: 'end'
          }}
        >
          <select
            name="product_id"
            value={form.product_id}
            onChange={handleChange}
            required
          >
            <option value="">Select product...</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} (stock: {p.stock_quantity})
              </option>
            ))}
          </select>

          <select
            name="movement_type"
            value={form.movement_type}
            onChange={handleChange}
          >
            <option value="in">Stock In</option>
            <option value="out">Stock Out</option>
            <option value="adjustment">Adjustment</option>
          </select>

          <input
            name="quantity"
            type="number"
            min="1"
            placeholder="Qty"
            value={form.quantity}
            onChange={handleChange}
            style={{ width: '70px' }}
            required
          />

          <input
            name="reason"
            placeholder="Reason"
            value={form.reason}
            onChange={handleChange}
          />

          <input
            name="notes"
            placeholder="Notes"
            value={form.notes}
            onChange={handleChange}
          />

          <button type="submit">Record</button>
        </form>
      </div>

      {/* =========================
          TABLE
      ========================= */}
      {loading && <p>Loading movements...</p>}
      {error && <Notice type="error">Couldn't load stock movements. {error}</Notice>}

      {!loading && !error && movements.length > 0 && (
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          backgroundColor: '#f9f9f9',
          border: '1px solid #333',
          textAlign: 'left'
        }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #555' }}>
              <th>Product</th>
              <th>Type</th>
              <th>Qty</th>
              <th>Reason</th>
              <th>When</th>
            </tr>
          </thead>

          <tbody>
            {movements.map(m => (
              <tr key={m.id} style={{ borderBottom: '1px solid #333' }}>
                <td>{m.product_name || '—'}</td>
                <td style={{ color: typeColors[m.movement_type] || '#888' }}>
                  {m.movement_type}
                </td>
                <td>{m.quantity}</td>
                <td>{m.reason || '—'}</td>
                <td>{m.created_ago || m.created_date || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}