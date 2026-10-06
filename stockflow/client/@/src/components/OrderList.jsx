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
    if (newStatus === 'confirmed') message = 'Confirm this order?';
    if (newStatus === 'cancelled') message = 'Cancel this order? This cannot be undone.';
    if (newStatus === 'fulfilled') message = 'Mark this order as fulfilled? Stock will be reduced.';

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

  const STATUS_BADGE = {
    draft: 'badge badge-muted',
    confirmed: 'badge badge-info',
    fulfilled: 'badge badge-success',
    cancelled: 'badge badge-danger',
  };

  const euro = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' });
  const money = (v) => {
    const n = Number(String(v).replace(/,/g, ''));
    return Number.isFinite(n) ? euro.format(n) : v;
  };

  return (
    <div>
      <div className="page-head">
        <h2 className="rainbow-text-title" style={{ margin: 0 }}>Orders</h2>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="confirmed">Confirmed</option>
          <option value="fulfilled">Fulfilled</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {loading && <p className="empty" role="status">Loading orders…</p>}
      {error && <p className="alert alert-error" role="alert">{error}</p>}

      {!loading && !error && orders.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Status</th>
                <th className="num">Total</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td style={{ fontWeight: 600 }}>{order.customer_name}</td>
                  <td>
                    <span className={STATUS_BADGE[order.status] || 'badge badge-muted'}>
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </span>
                  </td>
                  <td className="num">{money(order.total_amount)}</td>
                  <td>{order.created_ago || order.created_date || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {order.status === 'draft' && (
                        <button className="btn-primary" onClick={() => handleStatusChange(order.id, 'confirmed')}>
                          Confirm
                        </button>
                      )}
                      {order.status === 'confirmed' && (
                        <button className="btn-primary" onClick={() => handleStatusChange(order.id, 'fulfilled')}>
                          Fulfil
                        </button>
                      )}
                      {(order.status === 'draft' || order.status === 'confirmed') && (
                        <button className="signout-button" onClick={() => handleStatusChange(order.id, 'cancelled')}>
                          Cancel
                        </button>
                      )}
                      {(order.status === 'fulfilled' || order.status === 'cancelled') && (
                        <span className="product-sku">No actions</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && orders.length === 0 && (
        <p className="empty">No orders found.</p>
      )}
    </div>
  );
}
