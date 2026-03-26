import { useState } from 'react';
import { api } from '../services/api';

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
  const [imagePreview, setImagePreview] = useState(product?.image_url || null);
  const [uploading, setUploading] = useState(false);

  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);

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
    <div style={{ maxWidth: '700px', textAlign: 'center' }}>
      <h3 style={{
          fontSize: '2rem',
          fontWeight: 'bold',
          background: 'linear-gradient(90deg, red, rgb(234, 173, 58), yellow, #1abc9c, rgb(65, 169, 224))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          animation: 'rainbow 5s linear infinite',
          marginBottom: '10px',
          marginTop: '10px',
        }}
>{isEdit ? 'Edit Product' : 'New Product'}</h3>

      {message && (
        <p style={{ color: message.type === 'error' ? 'red' : 'green' }}>
          {message.text}
        </p>
      )}

      <form onSubmit={handleSubmit} 
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '15px',
          maxWidth: '300px',
          margin: '0 auto',
          padding: '20px',
          borderRadius: '12px',
          border: '3px solid #0bb5a9',
          backgroundColor: '#f9f9f9',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}>
        <input name="name" placeholder="Product name *" value={form.name} onChange={handleChange} required />
        <input name="sku" placeholder="SKU (e.g. SKU-1234) *" value={form.sku} onChange={handleChange} required />
        <input name="price" type="number" step="0.01" placeholder="Price *" value={form.price} onChange={handleChange} required />
        <textarea name="description" placeholder="Description (optional)" value={form.description} onChange={handleChange} rows={3} />
        <select name="category_id" value={form.category_id} onChange={handleChange}>
          <option value="">Select category...</option>
          {/* In a real app, you'd fetch categories from the API.
              For now, students can hardcode or ignore this field. */}
        </select>
        {/* Image upload */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
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
              style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '8px', border: '1px solid #444444' }}
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