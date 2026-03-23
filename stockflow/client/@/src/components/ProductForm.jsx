import { useState, useEffect } from 'react';
import { api } from '../services/api';

/**
 * OrderForm — Create a new order with line items
 *
 * WHAT THIS COMPONENT DOES:
 * - Fetches products so the user can select items
 * - Lets user add line items with quantity and unit price
 * - Calculates a preview total on the frontend
 * - Sends everything to POST /api/orders
 * - Frontend shows message for success/error
 *
 * WHAT STUDENTS NEED TO DO ON THE BACKEND:
 * - Exercise 5: Build POST /api/orders
 *   1. Validate customer_name and items
 *   2. Insert the order with status "draft"
 *   3. Insert each item into order_items table
 *   4. Update stock quantities in products table
 *   5. Calculate total_amount for the order
 *   6. Return the created order with 201 status
 */
export default function OrderForm({ onCreated = () => {} }) {
  const [products, setProducts] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  // --- Load products when component mounts ---
  useEffect(() => {
    api.getProducts()
      .then((data) => setProducts(Array.isArray(data) ? data : data.data || []))
      .catch(() => {});
  }, []);

  // --- Add a new empty line item ---
  const addItem = () => {
    setItems([...items, { product_id: '', product_name: '', quantity: 1, unit_price: 0 }]);
  };

  // --- Update a line item field ---
  const updateItem = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;

    // Auto-fill name and price when product selected
    if (field === 'product_id') {
      const product = products.find((p) => p.id === value);
      if (product) {
        updated[index].product_name = product.name;
        updated[index].unit_price = parseFloat(product.price);
      }
    }

    setItems(updated);
  };

  // --- Remove a line item ---
  const removeItem = (index) => setItems(items.filter((_, i) => i !== index));

  // --- Preview total ---
  const previewTotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

  // --- Handle form submit ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (items.length === 0) {
      setMessage({ type: 'error', text: 'Add at least one item' });
      return;
    }
    setSaving(true);
    setMessage(null);

    try {
      await api.createOrder({
        customer_name: customerName,
        notes,
        items: items.map((item) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
        })),
      });
      setMessage({ type: 'success', text: 'Order created as draft!' });
      setCustomerName('');
      setNotes('');
      setItems([]);
      onCreated();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dashboard-container" style={{ textAlign: 'center' }}>
      {/* 🌈 Page Title */}
      <h1
        className="rainbow-text-title"
        style={{
          fontSize: '2rem',
          fontWeight: 'bold',
          background: 'linear-gradient(90deg, red, rgb(234, 173, 58), yellow, #1abc9c, rgb(65, 169, 224))',
          backgroundSize: '400% 400%',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          animation: 'rainbow 5s linear infinite',
          marginBottom: '20px',
        }}
      >
        New Order
      </h1>

      {/* Feedback message */}
      {message && (
        <p style={{ color: message.type === 'error' ? 'red' : 'green' }}>{message.text}</p>
      )}

      {/* Order Form */}
      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '15px',
          maxWidth: '400px',
          margin: '0 auto',
          padding: '20px',
          borderRadius: '12px',
          border: '1px solid black',
          backgroundColor: '#f9f9f9',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}
      >
        <input
          placeholder="Customer name *"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          required
        />
        <textarea
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />

        {/* Line items section */}
        <h4 style={{ borderBottom: '2px solid #075751', paddingBottom: '5px', marginBottom: '10px' }}>
          Items
        </h4>

        {items.map((item, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
              justifyContent: 'center',
              flexWrap: 'wrap',
              marginBottom: '5px',
            }}
          >
            <select
              value={item.product_id}
              onChange={(e) => updateItem(i, 'product_id', e.target.value)}
              required
            >
              <option value="">Select product...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.price})
                </option>
              ))}
            </select>

            <input
              type="number"
              min="1"
              value={item.quantity}
              onChange={(e) => updateItem(i, 'quantity', parseInt(e.target.value) || 1)}
              style={{ width: '60px' }}
            />

            <span>{(item.quantity * item.unit_price).toFixed(2)}</span>

            <button
              type="button"
              style={{
                backgroundColor: 'red',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '3px 8px',
                cursor: 'pointer',
              }}
              onClick={() => removeItem(i)}
            >
              x
            </button>
          </div>
        ))}

        {/* Add line item button */}
        <button
          type="button"
          className="auth-button"
          style={{ width: 'fit-content', margin: '0 auto', display: 'block' }}
          onClick={addItem}
        >
          + Add Item
        </button>

        {/* Preview Total */}
        <p><strong>Preview Total: {previewTotal.toFixed(2)}</strong></p>

        {/* Submit Button */}
        <button
          type="submit"
          className="auth-button"
          style={{ width: '10rem', margin: '0 auto', display: 'block' }}
          disabled={saving}
        >
          {saving ? 'Creating...' : 'Create Order'}
        </button>
      </form>

      <style>
        {`
          @keyframes rainbow {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
        `}
      </style>
    </div>
  );
}