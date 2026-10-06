import { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function StockMovements({ onStockUpdate }) {
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
      console.error(err);
    }
  };

  useEffect(() => {
    fetchMovements();
    fetchProducts();
  }, []);

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
        text: `${product.name}: stock ${actionText}, now ${result.new_quantity} in stock.`
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

  const TYPE_BADGE = {
    in: { label: 'Stock in', className: 'badge badge-success' },
    out: { label: 'Stock out', className: 'badge badge-danger' },
    adjustment: { label: 'Adjustment', className: 'badge badge-info' },
  };

  return (
    <div>
      <h2 className="rainbow-text-title">Stock movements</h2>

      {message && (
        <p className={`alert ${message.type === 'error' ? 'alert-error' : 'alert-success'}`} role="status">
          {message.text}
        </p>
      )}

      <div className="form-card">
        <h3>Record a movement</h3>
        <form onSubmit={handleSubmit} className="form-grid">
          <div className="field field--wide">
            <label htmlFor="sm-product">Product</label>
            <select id="sm-product" name="product_id" value={form.product_id} onChange={handleChange} required>
              <option value="">Select a product…</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} (in stock: {p.stock_quantity})
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="sm-type">Type</label>
            <select id="sm-type" name="movement_type" value={form.movement_type} onChange={handleChange}>
              <option value="in">Stock in</option>
              <option value="out">Stock out</option>
              <option value="adjustment">Adjustment</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="sm-qty">Quantity</label>
            <input id="sm-qty" name="quantity" type="number" min="1" value={form.quantity} onChange={handleChange} required />
          </div>

          <div className="field">
            <label htmlFor="sm-reason">Reason</label>
            <input id="sm-reason" name="reason" placeholder="e.g. Delivery" value={form.reason} onChange={handleChange} />
          </div>

          <div className="field">
            <label htmlFor="sm-notes">Notes</label>
            <input id="sm-notes" name="notes" placeholder="Optional" value={form.notes} onChange={handleChange} />
          </div>

          <button type="submit">Record</button>
        </form>
      </div>

      <h3 className="section-title">Recent movements</h3>
      {loading && <p className="empty" role="status">Loading movements…</p>}
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {!loading && !error && movements.length === 0 && (
        <p className="empty">No stock movements yet.</p>
      )}

      {!loading && !error && movements.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Type</th>
                <th className="num">Qty</th>
                <th>Reason</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {movements.map(m => {
                const badge = TYPE_BADGE[m.movement_type] || { label: m.movement_type, className: 'badge badge-muted' };
                return (
                  <tr key={m.id}>
                    <td>{m.product_name || '—'}</td>
                    <td><span className={badge.className}>{badge.label}</span></td>
                    <td className="num">{m.quantity}</td>
                    <td>{m.reason || '—'}</td>
                    <td>{m.created_ago || m.created_date || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
