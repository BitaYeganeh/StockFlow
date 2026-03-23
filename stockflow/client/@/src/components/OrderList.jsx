import { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function OrderList() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = {};
        if (statusFilter) params.status = statusFilter;

        const data = await api.getOrders(params);
        if (data && Array.isArray(data.data)) setOrders(data.data);
        else if (Array.isArray(data)) setOrders(data);
        else setOrders([]);
      } catch (err) {
        setError(err.message || 'Failed to fetch orders');
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [statusFilter]);

  const handleStatusChange = async (orderId, newStatus) => {
    let message = '';
    if (newStatus === 'confirmed') message = 'Are you sure you want to CONFIRM this order?';
    if (newStatus === 'cancelled') message = 'Are you sure you want to CANCEL this order?';
    if (newStatus === 'fulfilled') message = 'Are you sure you want to FULFILL this order?';

    if (message && !window.confirm(message)) return; // ✅ confirmation alert

    try {
      await api.updateOrderStatus(orderId, newStatus);

      // Refresh orders after status change
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const data = await api.getOrders(params);
      if (data && Array.isArray(data.data)) setOrders(data.data);
      else if (Array.isArray(data)) setOrders(data);
      else setOrders([]);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const statusColors = {
    draft: '#888',
    confirmed: '#4488ff',
    fulfilled: '#44bb44',
    cancelled: '#cc4444'
  };

  return (
    <div className="dashboard-container" style={{ textAlign: 'center' }}>
      <h1 className="rainbow-text-title">Orders</h1>

      {/* Status Filter */}
      <div style={{ marginBottom: '20px' }}>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: '6px 12px',
            borderRadius: '6px',
            border: '1px solid #555',
            backgroundColor: 'inherit',
            color: 'inherit',
            fontSize: '0.95em'
          }}
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="confirmed">Confirmed</option>
          <option value="fulfilled">Fulfilled</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Loading/Error */}
      {loading && <p>Loading orders...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      {/* Orders Table */}
      {!loading && !error && orders.length > 0 && (
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          textAlign: 'left',
          margin: '0 auto',
          maxWidth: '900px'
        }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #555', backgroundColor: '#dff1ef' }}>
              <th style={{ padding: '10px' }}>Customer</th>
              <th>Status</th>
              <th>Total</th>
              <th>Created</th>
              <th>Age</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} style={{ borderBottom: '1px solid #333' }}>
                <td style={{ padding: '8px 12px' }}>{order.customer_name}</td>
                <td>
                  <span style={{ color: statusColors[order.status] || '#888', fontWeight: 'bold' }}>
                    {order.status}
                  </span>
                </td>
                <td>{order.total_amount}</td>
                <td>{order.created_date || order.created_at}</td>
                <td>{order.created_ago || '—'}</td>
                <td style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {order.status === 'draft' && (
                    <>
                      <button
                        className="auth-button"
                        style={{ backgroundColor: '#4488ff' }}
                        onClick={() => handleStatusChange(order.id, 'confirmed')}
                      >
                        Confirm
                      </button>
                      <button
                        className="auth-button"
                        style={{ backgroundColor: '#cc4444' }}
                        onClick={() => handleStatusChange(order.id, 'cancelled')}
                      >
                        Cancel
                      </button>
                    </>
                  )}

                  {order.status === 'confirmed' && (
                    <>
                      <button
                        className="auth-button"
                        style={{ backgroundColor: '#44bb44' }}
                        onClick={() => handleStatusChange(order.id, 'fulfilled')}
                      >
                        Fulfill
                      </button>
                      <button
                        className="auth-button"
                        style={{ backgroundColor: '#cc4444' }}
                        onClick={() => handleStatusChange(order.id, 'cancelled')}
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!loading && !error && orders.length === 0 && (
        <p style={{ marginTop: '20px', fontStyle: 'italic', color: '#555' }}>No orders found.</p>
      )}
    </div>
  );
}