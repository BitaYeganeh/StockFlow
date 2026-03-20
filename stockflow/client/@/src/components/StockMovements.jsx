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
        text: `Product "${product.name}" stock ${actionText} (new qty: ${result.new_quantity})`
      });

      // =========================
      // Sync with backend
      // =========================
      setTimeout(() => {
        fetchProducts();
        fetchMovements();
      }, 300);

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

  return (
    <div>
      <h2>Stock Movements</h2>

      {/* =========================
          MESSAGE BOX
      ========================= */}
      {message && (
<div style={{
  marginBottom: '15px',
  padding: '12px',
  borderRadius: '6px',
  background: message.type === 'error' ? '#2c1f1f' : '#1f2c1f',
  border: '1px solid #444',
  // Rainbow text styles
  backgroundImage: message.type === 'error'
    ? 'linear-gradient(90deg, #e391cf, #036053)'
    : 'linear-gradient(90deg, #e9190e, #f1c40f, #1abc9c)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  fontWeight: 'bold'
}}>
  {message.text}
</div>
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
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      {!loading && !error && movements.length > 0 && (
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
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

                <td style={{
                  color: typeColors[m.movement_type] || '#888'
                }}>
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

      {!loading && !error && movements.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '10px',
          marginBottom: '15px',
          border: '10px dashed #1abc9c; ',
          borderRadius: '80px',
          color: '#aaa'
        }}>
          
        </div>
      )}
    </div>
  );
}