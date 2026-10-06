import { useState, useEffect } from 'react';
import { api, assetUrl } from '../services/api';

const CATEGORIES = [
  'Audio',
  'Cables & Adapters',
  'Displays',
  'Keyboards',
  'Mice & Peripherals',
  'Power & Charging',
];

const STOCK_BADGE = {
  in_stock: { label: 'In stock', className: 'badge badge-success' },
  low_stock: { label: 'Low stock', className: 'badge badge-warning' },
  out_of_stock: { label: 'Out of stock', className: 'badge badge-danger' },
};

const euro = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' });
// The API sends prices as text like "1,000.00"
const formatPrice = (price) => {
  const value = Number(String(price).replace(/,/g, ''));
  return Number.isFinite(value) ? euro.format(value) : price;
};

// =========================
// Pagination Component
// =========================
const Pagination = ({ page, totalPages, setPage, limit, setLimit, total }) => {
  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (page <= 4) pages.push(1, 2, 3, 4, 5, '...', totalPages);
      else if (page >= totalPages - 3)
        pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      else pages.push(1, '...', page - 1, page, page + 1, '...', totalPages);
    }
    return pages;
  };

  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="pagination">
      <span>
        Showing {from}–{to} of {total}
      </span>

      {totalPages > 1 && (
        <div className="pagination__pages">
          <button onClick={() => setPage(page - 1)} disabled={page === 1} aria-label="Previous page">
            ‹
          </button>
          {getPageNumbers().map((p, idx) => (
            <button
              key={idx}
              onClick={() => typeof p === 'number' && setPage(p)}
              disabled={typeof p !== 'number'}
              className={p === page ? 'is-current' : undefined}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </button>
          ))}
          <button onClick={() => setPage(page + 1)} disabled={page === totalPages} aria-label="Next page">
            ›
          </button>
        </div>
      )}

      <select
        value={limit}
        onChange={(e) => { setPage(1); setLimit(Number(e.target.value)); }}
        aria-label="Products per page"
      >
        <option value={10}>10 per page</option>
        <option value={25}>25 per page</option>
        <option value={40}>40 per page</option>
      </select>
    </div>
  );
};

// =========================
// Product List Component
// =========================
export default function ProductList() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('active');

  // =========================
  // Fetch products
  // =========================
  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit };
      if (search) params.search = search;
      if (category) params.category = category;
      if (status) params.status = status;

      const data = await api.getProducts(params);

      setProducts(Array.isArray(data) ? data : data.data || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [search, category, status, page, limit]);

  const totalPages = Math.ceil(total / limit);

  return (
    <section>
      <div className="page-head">
        <div>
          <h2>Products</h2>
          <p>Stock levels update when stock is recorded or orders are fulfilled.</p>
        </div>

        <div className="filters">
          <input
            type="search"
            placeholder="Search by name…"
            aria-label="Search products"
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value); }}
          />
          <select
            value={category}
            onChange={(e) => { setPage(1); setCategory(e.target.value); }}
            aria-label="Category"
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => { setPage(1); setStatus(e.target.value); }}
            aria-label="Status"
          >
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="">All</option>
          </select>
        </div>
      </div>

      {error && <p className="alert alert-error" role="alert">{error}</p>}

      {loading ? (
        <p className="empty" role="status">Loading products… (the free server can take up to a minute to wake up)</p>
      ) : !error && products.length === 0 ? (
        <p className="empty">No products match your filters.</p>
      ) : !error && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th className="num">Price</th>
                <th className="num">Stock</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const badge = STOCK_BADGE[product.stock_status] || {
                  label: product.stock_status,
                  className: 'badge badge-muted',
                };
                return (
                  <tr key={product.id}>
                    <td>
                      <div className="product-cell">
                        {product.image_url ? (
                          <img className="thumb" src={assetUrl(product.image_url)} alt="" />
                        ) : (
                          <span className="thumb" aria-hidden="true">
                            {product.name.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                        <div>
                          <div className="product-name">{product.name}</div>
                          <div className="product-sku">{product.sku}</div>
                        </div>
                      </div>
                    </td>
                    <td>{product.category_name}</td>
                    <td className="num">{formatPrice(product.price)}</td>
                    <td className="num">{product.stock_quantity}</td>
                    <td>
                      <span className={badge.className}>{badge.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && (
        <Pagination
          page={page}
          totalPages={totalPages}
          setPage={setPage}
          limit={limit}
          setLimit={setLimit}
          total={total}
        />
      )}
    </section>
  );
}
