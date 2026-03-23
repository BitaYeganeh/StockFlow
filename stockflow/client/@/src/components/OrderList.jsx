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

        // Fetch orders from API
        const data = await api.getOrders(params);

        console.log('[OrderList] Fetched orders:', data); // DEBUG log

        // Always use data.data if exists, otherwise fallback to empty array
        if (data && Array.isArray(data.data)) setOrders(data.data);
        else if (Array.isArray(data)) setOrders(data);
        else setOrders([]);

      } catch (err) {
        console.error('[OrderList] Error fetching orders:', err);
        setError(err.message || 'Failed to fetch orders');
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [statusFilter]);

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await api.updateOrderStatus(orderId, newStatus);

      // Refresh the list after status change
      const params = {};
      if (statusFilter) params.status = statusFilter;

      const data = await api.getOrders(params);
      console.log('[OrderList] Orders after status update:', data); // DEBUG log

      if (data && Array.isArray(data.data)) setOrders(data.data);
      else if (Array.isArray(data)) setOrders(data);
      else setOrders([]);

    } catch (err) {
      console.error('[OrderList] Error updating status:', err);
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
    <div>
      <h2>Orders</h2>
      <div style={{ marginBottom: '15px' }}>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="confirmed">Confirmed</option>
          <option value="fulfilled">Fulfilled</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {loading && <p>Loading orders...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      {!loading && !error && orders.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #555' }}>
              <th>Customer</th>
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
                <td>{order.customer_name}</td>
                <td>
                  <span style={{ color: statusColors[order.status] || '#888' }}>
                    {order.status}
                  </span>
                </td>
                <td>{order.total_amount}</td>
                <td>{order.created_date || order.created_at}</td>
                <td>{order.created_ago || '—'}</td>
                <td>
                  {order.status === 'draft' && (
                    <>
                      <button onClick={() => handleStatusChange(order.id, 'confirmed')}>Confirm</button>
                      <button onClick={() => handleStatusChange(order.id, 'cancelled')}>Cancel</button>
                    </>
                  )}
                  {order.status === 'confirmed' && (
                    <>
                      <button onClick={() => handleStatusChange(order.id, 'fulfilled')}>Fulfill</button>
                      <button onClick={() => handleStatusChange(order.id, 'cancelled')}>Cancel</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!loading && !error && orders.length === 0 && <p>No orders found.</p>}
    </div>
  );
}