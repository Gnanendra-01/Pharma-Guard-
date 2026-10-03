'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(({ message, type = 'info', duration = 4000 }) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
    return id;
  }, [removeToast]);

  const toast = {
    success: (msg, dur) => addToast({ message: msg, type: 'success', duration: dur }),
    error: (msg, dur) => addToast({ message: msg, type: 'error', duration: dur || 5000 }),
    warning: (msg, dur) => addToast({ message: msg, type: 'warning', duration: dur }),
    info: (msg, dur) => addToast({ message: msg, type: 'info', duration: dur }),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast Notification Container */}
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full px-4 pointer-events-none"
        aria-live="polite"
      >
        {toasts.map((t) => {
          let bgClass = 'bg-white border-line text-ink';
          let IconComponent = Info;
          let iconColor = 'text-primary';

          if (t.type === 'success') {
            bgClass = 'bg-white border-green-200 text-ink';
            IconComponent = CheckCircle2;
            iconColor = 'text-green-600';
          } else if (t.type === 'error') {
            bgClass = 'bg-white border-red-200 text-ink';
            IconComponent = AlertCircle;
            iconColor = 'text-red-600';
          } else if (t.type === 'warning') {
            bgClass = 'bg-white border-amber-200 text-ink';
            IconComponent = AlertTriangle;
            iconColor = 'text-amber-600';
          }

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-lg transition-all animate-[slideInRight_0.2s_ease-out] ${bgClass}`}
              role="alert"
            >
              <IconComponent className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconColor}`} />
              <div className="flex-1 text-sm font-medium leading-relaxed">{t.message}</div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="text-muted hover:text-ink p-1 -mr-1 -mt-1 rounded-md transition-colors"
                aria-label="Close notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
