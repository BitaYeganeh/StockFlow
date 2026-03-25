import { useState, useEffect } from 'react';
import { api } from '../services/api';

/**
 * AIPanel — AI-powered features using Gemini
 *
 * WHAT THIS COMPONENT DOES:
 * - Buttons to trigger AI actions
 * - Shows AI responses in a simple text area
 *
 * WHAT STUDENTS NEED TO DO ON THE BACKEND:
 * - Exercise 6: Build the AI routes that use GeminiAI class
 *   - /api/ai/describe — generate product descriptions
 *   - /api/ai/stock-advice — get reorder recommendations
 *   - /api/ai/summarize-orders — summarize order trends
 */
export default function AIPanel() {
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('');

  // Load products for the description generator
  useEffect(() => {
    api.getProducts()
      .then((data) => setProducts(Array.isArray(data) ? data : data.data || []))
      .catch(() => {});
  }, []);

  const callAI = async (action) => {
    setLoading(true);
    setError(null);
    setResult('');

    try {
      let data;
      switch (action) {
        case 'describe':
          if (!selectedProduct) {
            setError('Select a product first');
            setLoading(false);
            return;
          }
          data = await api.generateDescription(selectedProduct);
          break;
        case 'stock-advice':
          data = await api.getStockAdvice();
          break;
        case 'summarize':
          data = await api.summarizeOrders();
          break;
      }
      // The backend should return { result: "..." } or { description: "..." }
      setResult(data.result || data.description || data.advice || data.summary || JSON.stringify(data));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="rainbow-text-title">AI Assistant</h2>

      {/* Product Description Generator */}
      <div style={{ marginBottom: '20px', padding: '15px', border: '3px solid #187775', borderRadius: '8px' }}>
        <h3 style={{ textAlign: 'center', color: '#187775', margin: '0 0 20px 0' }}>Generate Product Description</h3>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center' }}>
          <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)}>
            <option value="">Select product...</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button style={{ backgroundColor: '#11b7b4', color: 'black', border: 'black', padding: '10px 20px', borderRadius: '4px' } } onClick={() => callAI('describe')} disabled={loading}>
            {loading ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', justifyContent: 'center' }}>
        <button style={{ backgroundColor: '#11b7b4', color: 'black', border: 'black', padding: '10px 20px', borderRadius: '4px' }} onClick={() => callAI('stock-advice')} disabled={loading}>
          Get Stock Advice
        </button>
        <button style={{ backgroundColor: '#11b7b4', color: 'black', border: 'black', padding: '10px 20px', borderRadius: '4px' }}  onClick={() => callAI('summarize')} disabled={loading}>
          Summarize Orders
        </button>
      </div>

      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      {result && (
        <div style={{ padding: '15px', border: '3px solid #187775', borderRadius: '8px', whiteSpace: 'pre-wrap' }}>
          <h4 style={{ color: '#09b6b3' }}>AI Response:</h4>
          <p>{result}</p>
        </div>
      )}
    </div>
  );
}
