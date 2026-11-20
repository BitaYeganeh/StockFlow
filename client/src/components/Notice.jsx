/**
 * Notice — Inline notification box for error / success / info messages
 *
 * Usage:
 *   <Notice type="error" onClose={() => setError(null)}>{error}</Notice>
 *
 * Errors are announced to screen readers immediately (role="alert");
 * success and info messages are announced politely (role="status").
 */
const ICONS = { error: '⚠️', success: '✅', info: 'ℹ️' };

export default function Notice({ type = 'info', children, onClose }) {
  if (!children) return null;

  return (
    <div className={`notice notice-${type}`} role={type === 'error' ? 'alert' : 'status'}>
      <span className="notice-icon" aria-hidden="true">{ICONS[type]}</span>
      <span className="notice-text">{children}</span>
      {onClose && (
        <button type="button" className="notice-close" onClick={onClose} aria-label="Dismiss">
          ×
        </button>
      )}
    </div>
  );
}
