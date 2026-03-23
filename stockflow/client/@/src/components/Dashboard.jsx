import { useState, useEffect } from 'react';
import { api } from '../services/api';

/**
 * Dashboard — Summary statistics
 *
 * WHAT THIS COMPONENT DOES:
 * - Fetches aggregated data from GET /api/dashboard/summary
 * - Displays summary cards for inventory and orders
 * - Shows a low stock alert list
 *
 * WHAT STUDENTS NEED TO DO ON THE BACKEND:
 * - Exercise 7: Build GET /api/dashboard/summary
 *   - Fetch products and orders from Supabase
 *   - Calculate inventory stats (total value, low stock count, etc.)
 *   - Calculate order stats (by status, revenue)
 *   - Return everything in the expected JSON structure
 */
export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getDashboardSummary()
      .then((data) => setSummary(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading dashboard...</p>;
  if (error) return <p style={{ color: 'red' }}>Error: {error}</p>;
  if (!summary) return <p>No data available. Have you built the dashboard endpoint?</p>;

  const { inventory, orders, low_stock_products } = summary;

  return (
    <div className="dashboard-container">

      {/* 🌈 Dashboard Title */}
      <h1 className="rainbow-text-title">
        Dashboard
      </h1>

      {/* Summary Cards */}
      <div
        style={{
          display: 'flex',
          gap: '15px',
          flexWrap: 'wrap',
          marginBottom: '20px',
          justifyContent: 'center'
        }}
      >

        {/* Inventory Card */}
        <div className="dashboard-card">
          <h4>Inventory</h4>
          <hr className="card-divider" />

          <p>Total Products: <strong>{inventory?.total_products || 0}</strong></p>
          <p>Total Value: <strong>{inventory?.total_value || '0.00'}</strong></p>
          <p style={{ color: 'orange' }}>
            Low Stock: <strong>{inventory?.low_stock_count || 0}</strong>
          </p>
          <p style={{ color: 'red' }}>
            Out of Stock: <strong>{inventory?.out_of_stock_count || 0}</strong>
          </p>
        </div>

        {/* Orders Card */}
        <div className="dashboard-card">
          <h4>Orders</h4>
          <hr className="card-divider" />

          <p>Total Orders: <strong>{orders?.total_orders || 0}</strong></p>
          <p>Revenue: <strong>{orders?.total_revenue || '0.00'}</strong></p>

          {orders?.by_status && (
            <div style={{ marginTop: '10px' }}>
              <p className="status-draft">
                Draft: {orders.by_status.draft || 0}
              </p>
              <p className="status-confirmed">
                Confirmed: {orders.by_status.confirmed || 0}
              </p>
              <p className="status-fulfilled">
                Fulfilled: {orders.by_status.fulfilled || 0}
              </p>
              <p className="status-cancelled">
                Cancelled: {orders.by_status.cancelled || 0}
              </p>
            </div>
          )}
        </div>

      </div>

      {/* Low Stock Alerts */}
      {low_stock_products && low_stock_products.length > 0 && (
        <div>
          <h3 className="section-title">Low Stock Alerts</h3>

          <table
            style={{
              margin: '0 auto',
              borderCollapse: 'collapse',
              width: '90%',
              maxWidth: '500px',
              textAlign: 'center'
            }}
          >
            <thead>
              <tr style={{ borderBottom: '2px solid #555' }}>
                <th className="rainbow-header">Product</th>
                <th className="rainbow-header">Stock</th>
                <th className="rainbow-header">Threshold</th>
              </tr>
            </thead>

            <tbody>
              {low_stock_products.map((p, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #333' }}>
                  <td>{p.name}</td>
                  <td className={p.stock_quantity === 0 ? 'status-cancelled' : 'status-confirmed'}>
                    {p.stock_quantity}
                  </td>
                  <td>{p.reorder_threshold}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}