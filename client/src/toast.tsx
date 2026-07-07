import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

interface ToastContextValue {
  showToast: (msg: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(''), 1600);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div
          style={{
            position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)',
            zIndex: 80, background: '#1a1714', color: '#f4f1ea', padding: '14px 22px',
            borderRadius: 16, font: "500 14px 'Iansui'", boxShadow: '0 14px 30px -12px rgba(0,0,0,.5)',
            animation: 'toastIn .3s ease both', whiteSpace: 'nowrap',
          }}
        >
          {toast}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
