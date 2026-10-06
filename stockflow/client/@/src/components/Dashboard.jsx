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

  if (loading) return <p className="empty" role="status">Loading dashboard…</p>;
  if (error) return <p className="alert alert-error" role="alert">{error}</p>;
  if (!summary) return <p className="empty">No dashboard data yet.</p>;

  const { inventory, orders, low_stock_products } = summary;

  const euro = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' });
  const money = (v) => euro.format(Number(v) || 0);

  const tiles = [
    { label: 'Products', value: inventory?.total_products || 0 },
    { label: 'Stock value', value: money(inventory?.total_value) },
    { label: 'Low stock', value: inventory?.low_stock_count || 0, tone: 'warning' },
    { label: 'Out of stock', value: inventory?.out_of_stock_count || 0, tone: 'danger' },
    { label: 'Orders', value: orders?.total_orders || 0 },
    { label: 'Revenue', value: money(orders?.total_revenue) },
  ];

  const byStatus = orders?.by_status || {};
  const STATUS = [
    ['draft', 'Draft', 'badge badge-muted'],
    ['confirmed', 'Confirmed', 'badge badge-info'],
    ['fulfilled', 'Fulfilled', 'badge badge-success'],
    ['cancelled', 'Cancelled', 'badge badge-danger'],
  ];

  return (
    <div>
      <h2 className="rainbow-text-title">Dashboard</h2>

      <div className="stat-grid">
        {tiles.map((t) => (
          <div key={t.label} className={`stat${t.tone ? ` stat--${t.tone}` : ''}`}>
            <span className="stat__label">{t.label}</span>
            <span className="stat__value">{t.value}</span>
          </div>
        ))}
      </div>

      <h3 className="section-title">Orders by status</h3>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {STATUS.map(([key, label, cls]) => (
          <span key={key} className={cls}>
            {label}: {byStatus[key] || 0}
          </span>
        ))}
      </div>

      <h3 className="section-title">Low stock alerts</h3>
      {low_stock_products && low_stock_products.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th className="num">In stock</th>
                <th className="num">Reorder at</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {low_stock_products.map((p, i) => (
                <tr key={i}>
                  <td>{p.name}</td>
                  <td className="num">{p.stock_quantity}</td>
                  <td className="num">{p.reorder_threshold}</td>
                  <td>
                    {p.stock_quantity === 0
                      ? <span className="badge badge-danger">Out of stock</span>
                      : <span className="badge badge-warning">Reorder soon</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty">Every product is above its reorder level.</p>
      )}
    </div>
  );
}
