// ============================================================================
// ToastProvider + useToast
// ----------------------------------------------------------------------------
// Notificaciones flotantes reutilizables (info / success / warn / danger).
// Reutiliza las clases CSS existentes (.monopoly-toast-stack, .monopoly-toast)
// para mantener la identidad visual ya presente en el proyecto.
//
// Uso:
//   <ToastProvider>...app...</ToastProvider>
//   const toast = useToast();
//   toast.success("Compraste Avenida Mediterraneo");
//   toast.danger("Pagaste $200 de renta", { title: "Renta" });
// ============================================================================

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

const ToastContext = createContext(null);

const TONE_ICON = {
  info: "i",
  success: "✓",
  warn: "!",
  danger: "×"
};

function ToastCard({ toast, onClose }) {
  return (
    <div className={`monopoly-toast tone-${toast.tone}`} role="status">
      <span className="toast-glyph" aria-hidden="true">
        {TONE_ICON[toast.tone] || "i"}
      </span>
      <div className="min-w-0 flex-1">
        {toast.title ? <p className="font-extrabold leading-tight">{toast.title}</p> : null}
        <p className="text-sm leading-snug opacity-90">{toast.message}</p>
      </div>
      <button type="button" className="toast-close" onClick={() => onClose(toast.id)} aria-label="Cerrar">
        ×
      </button>
    </div>
  );
}

export function ToastProvider({ children, defaultDuration = 4200, max = 4 }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());
  const counter = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (message, options = {}) => {
      const id = `toast_${Date.now()}_${counter.current++}`;
      const tone = options.tone || "info";
      const duration = options.duration ?? defaultDuration;
      setToasts((list) => {
        const next = [...list, { id, message, tone, title: options.title || null }];
        return next.slice(-max);
      });
      if (duration > 0) {
        const timer = setTimeout(() => dismiss(id), duration);
        timers.current.set(id, timer);
      }
      return id;
    },
    [defaultDuration, dismiss, max]
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const api = useMemo(
    () => ({
      push,
      dismiss,
      info: (message, options) => push(message, { ...options, tone: "info" }),
      success: (message, options) => push(message, { ...options, tone: "success" }),
      warn: (message, options) => push(message, { ...options, tone: "warn" }),
      danger: (message, options) => push(message, { ...options, tone: "danger" })
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="monopoly-toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onClose={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback inerte para usar componentes fuera del provider.
    const noop = () => "";
    return { push: noop, dismiss: () => {}, info: noop, success: noop, warn: noop, danger: noop };
  }
  return ctx;
}

export default ToastProvider;
