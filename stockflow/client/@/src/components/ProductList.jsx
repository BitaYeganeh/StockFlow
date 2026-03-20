import { useState, useEffect } from 'react';
import { api } from '../services/api';
import StockMovements from './StockMovements';

// =========================
// Pagination
// =========================
const Pagination = ({ page, totalPages, setPage, limit, setLimit }) => {
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

  return (
    <div style={{ margin: '15px 0', display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
      <select value={limit} onChange={(e) => { setPage(1); setLimit(Number(e.target.value)); }}>
        <option value={10}>10 / page</option>
        <option value={25}>25 / page</option>
        <option value={40}>40 / page</option>
      </select>

      <button onClick={() => setPage(page - 1)} disabled={page === 1}>◀</button>

      {getPageNumbers().map((p, idx) => (
        <button
          key={idx}
          onClick={() => typeof p === 'number' && setPage(p)}
          disabled={typeof p !== 'number'}
          style={{
            fontWeight: p === page ? 'bold' : 'normal',
            background: p === page ? '#1abc9c' : '#ecf0f1',
            color: p === page ? '#fff' : '#2c3e50',
            border: '1px solid #444',
            padding: '5px 10px',
          }}
        >
          {p}
        </button>
      ))}

      <button onClick={() => setPage(page + 1)} disabled={page === totalPages}>▶</button>

      <span style={{ marginLeft: '10px' }}>
        Page {page} of {totalPages}
      </span>
    </div>
  );
};

// =========================
// Product List
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

  // =========================
  // ✅ FINAL FIX: ALWAYS REFRESH FROM BACKEND
  // =========================
  const updateProductStock = () => {
    fetchProducts(); // 🔥 ONLY TRUST DATABASE
  };

  return (
    <div>
      <h2 style={{ color: 'rgb(26, 188, 156)', textAlign: 'center', fontSize: '36px' }}>
        Products
      </h2>

      {/* ✅ Stock Movements */}
      <StockMovements onStockUpdate={updateProductStock} />

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search products..."
          value={search}
          onChange={(e) => { setPage(1); setSearch(e.target.value); }}
        />

        <select value={category} onChange={(e) => { setPage(1); setCategory(e.target.value); }}>
          <option value="">All Categories</option>
          <option value="Audio">Audio</option>
          <option value="Cables & Adapters">Cables & Adapters</option>
          <option value="Displays">Displays</option>
          <option value="Keyboards">Keyboards</option>
          <option value="Mice & Peripherals">Mice & Peripherals</option>
          <option value="Power & Charging">Power & Charging</option>
        </select>

        <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
          <option value="">All</option>
        </select>
      </div>

      {!loading && totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} setPage={setPage} limit={limit} setLimit={setLimit} />
      )}

      {loading && <p>Loading products...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      {!loading && !error && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th></th>
              <th>Name</th>
              <th>SKU</th>
              <th>Category</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {products.map(product => (
              <tr key={product.id}>
                <td>
                  {product.image_url ? (
                    <img src={product.image_url} alt="" style={{ width: 40 }} />
                  ) : '—'}
                </td>
                <td>{product.name}</td>
                <td>{product.sku}</td>
                <td>{product.category_name}</td>
                <td>{product.price}</td>
                <td>{product.stock_quantity}</td>
                <td>{product.stock_status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!loading && totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} setPage={setPage} limit={limit} setLimit={setLimit} />
      )}
    </div>
  );
}