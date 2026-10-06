import { useEffect, useState } from 'react';
import { api, assetUrl } from '../services/api';

/**
 * ProductForm — Create or edit a product with image upload
 *
 * WHAT THIS COMPONENT DOES:
 * - Shows a form with fields for product data
 * - Allows selecting an image file to upload
 * - Uploads the image first (POST /api/products/upload-image), gets back a URL
 * - Then creates/updates the product with the image_url included
 * - Displays success/error messages from the backend
 *
 * WHAT STUDENTS NEED TO DO ON THE BACKEND:
 * - Exercise 4: Build POST /api/products and PUT /api/products/{id}
 * - Exercise 8: Build POST /api/products/upload-image
 *   - Validate file type and size
 *   - Upload to Supabase Storage
 *   - Return the public URL
 */
export default function ProductForm({ product = null, onSaved = () => {} }) {
  const isEdit = !!product;

  const [form, setForm] = useState({
    name: product?.name || '',
    sku: product?.sku || '',
    price: product?.price || '',
    description: product?.description || '',
    category_id: product?.category_id || '',
  });

  // Image state
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(assetUrl(product?.image_url) || null);
  const [uploading, setUploading] = useState(false);

  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState([]);

  // Load the category list for the dropdown
  useEffect(() => {
    api.getCategories()
      .then((res) => setCategories(res.data || []))
      .catch(() => setCategories([]));
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // When a file is selected, show a local preview
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImageFile(file);
    // Create a local preview URL (this is a browser-only URL, not uploaded yet)
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      let imageUrl = product?.image_url || null;

      // Step 1: If a new image was selected, upload it first
      // This calls POST /api/products/upload-image (Exercise 8)
      if (imageFile) {
        setUploading(true);
        const uploadResult = await api.uploadProductImage(imageFile);
        imageUrl = uploadResult.image_url;
        setUploading(false);
      }

      // Step 2: Create or update the product with the image_url
      const productData = { ...form };
      if (imageUrl) {
        productData.image_url = imageUrl;
      }

      if (isEdit) {
        await api.updateProduct(product.id, productData);
        setMessage({ type: 'success', text: 'Product updated!' });
      } else {
        await api.createProduct(productData);
        setMessage({ type: 'success', text: 'Product created!' });
        setForm({ name: '', sku: '', price: '', description: '', category_id: '' });
        setImageFile(null);
        setImagePreview(null);
      }
      onSaved();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
      setUploading(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="form-page">
      <h2 className="rainbow-text-title">{isEdit ? 'Edit Product' : 'New Product'}</h2>

      {message && (
        <p className={`alert ${message.type === 'error' ? 'alert-error' : 'alert-success'}`} role="status">
          {message.text}
        </p>
      )}

      <form onSubmit={handleSubmit} className="form-card form-stack">
        <input name="name" placeholder="Product name *" value={form.name} onChange={handleChange} required />
        <input name="sku" placeholder="SKU (e.g. SKU-1234) *" value={form.sku} onChange={handleChange} required />
        <input name="price" type="number" step="0.01" placeholder="Price *" value={form.price} onChange={handleChange} required />
        <textarea name="description" placeholder="Description (optional)" value={form.description} onChange={handleChange} rows={3} />
        <select name="category_id" value={form.category_id} onChange={handleChange} required aria-label="Category">
          <option value="">Select a category *</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {/* Image upload */}
        <label className="field">
          <span>Product Image</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleFileChange}
            style ={{ border: '1px solid black', padding: '6px', borderRadius: '6px' }}  
          />
        </label>

        {/* Image preview */}
        {imagePreview && (
          <div>
            <img
              src={imagePreview}
              alt="Preview"
              style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '8px', border: '1px solid var(--border)' }}
            />
          </div>
        )}
        <div style={{ height: '10px', justifyContent: 'center', alignItems: 'center', display: 'flex' }}>
        <button type="submit" disabled={saving || uploading} style ={{
          display: 'flex',
          flexDirection: 'column',
          padding: '6px',
          width: '50%',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '6px',
          backgroundColor: '#0bb5a9',
          color: 'white',
          marginTop: '10px',
          marginBottom: '6px',
        }}>
          {uploading ? 'Uploading image...' : saving ? 'Saving...' : isEdit ? 'Update Product' : 'Create Product'}
        </button>
        </div>
      </form>
    </div>
  );
}