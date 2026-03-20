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
  // --- State variables ---
  const [products, setProducts] = useState([]); // List of products for the dropdown
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([]); // Order line items
  const [message, setMessage] = useState(null); // Success/error message
  const [saving, setSaving] = useState(false); // Loading state

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

    // When product is selected, auto-fill name and unit price
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
  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // --- Calculate frontend preview total ---
  const previewTotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

  // --- Handle order submission ---
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation: must have at least one item
    if (items.length === 0) {
      setMessage({ type: 'error', text: 'Add at least one item' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      // --- Send order to backend ---
      // Backend (Exercise 5) handles:
      //   - inserting order with status "draft"
      //   - inserting each item
      //   - updating stock
      //   - calculating total_amount
      await api.createOrder({
        customer_name: customerName,
        notes: notes,
        items: items.map((item) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
        })),
      });

      // --- Reset form & show success ---
      setMessage({ type: 'success', text: 'Order created as draft!' });
      setCustomerName('');
      setNotes('');
      setItems([]);
      onCreated(); // Callback to refresh orders list if needed
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h3>New Order</h3>

      {/* --- Show success or error message --- */}
      {message && (
        <p style={{ color: message.type === 'error' ? 'red' : 'green' }}>{message.text}</p>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '600px' }}>
        {/* Customer name input */}
        <input
          placeholder="Customer name *"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          required
        />

        {/* Notes input */}
        <textarea
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />

        <h4>Items</h4>

        {/* Line items */}
        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {/* Product dropdown */}
            <select
              value={item.product_id}
              onChange={(e) => updateItem(i, 'product_id', e.target.value)}
              required
            >
              <option value="">Select product...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.price})</option>
              ))}
            </select>

            {/* Quantity input */}
            <input
              type="number"
              min="1"
              value={item.quantity}
              onChange={(e) => updateItem(i, 'quantity', parseInt(e.target.value) || 1)}
              style={{ width: '60px' }}
            />

            {/* Line total */}
            <span>{(item.quantity * item.unit_price).toFixed(2)}</span>

            {/* Remove button */}
            <button type="button" onClick={() => removeItem(i)}>x</button>
          </div>
        ))}

        {/* Add new line item */}
        <button type="button" onClick={addItem}>+ Add Item</button>

        {/* Preview total */}
        <p><strong>Preview Total: {previewTotal.toFixed(2)}</strong></p>

        {/* Submit button */}
        <button type="submit" disabled={saving}>
          {saving ? 'Creating...' : 'Create Order'}
        </button>
      </form>
    </div>
  );
}