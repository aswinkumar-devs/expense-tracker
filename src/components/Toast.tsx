import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type Toast = { id: number; message: string; type: 'success' | 'error' | 'info' };

type ToastCtx = {
  notify: (message: string, type?: Toast['type']) => void;
};

const Ctx = createContext<ToastCtx | null>(null);

export function useToast() {
  const c = useContext(Ctx);
  if (!c) throw new Error('ToastProvider missing');
  return c;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  }, []);

  return (
    <Ctx.Provider value={{ notify }}>
      {children}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center w-full px-4 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium animate-toast-in max-w-full ${
              t.type === 'success'
                ? 'bg-emerald-600 text-white'
                : t.type === 'error'
                ? 'bg-red-600 text-white'
                : 'bg-gray-800 text-white'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
