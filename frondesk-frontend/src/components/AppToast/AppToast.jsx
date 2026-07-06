import { createContext, useCallback, useContext, useState } from 'react';
import './AppToast.css';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback(({ title, message, variant = 'info', duration = 5000 }) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, title, message, variant }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="app-toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`app-toast app-toast--${t.variant}`}>
            {t.title && <div className="app-toast__title">{t.title}</div>}
            {t.message && <div className="app-toast__message">{t.message}</div>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
