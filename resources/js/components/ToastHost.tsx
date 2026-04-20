import { useEffect, useState } from 'react';

type ToastType = 'success' | 'error' | 'loading';

type ToastMessage = {
  id: string;
  type: ToastType;
  message: string;
};

export default function ToastHost() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<ToastMessage>;
      const toast = customEvent.detail;
      if (!toast?.id || !toast?.message) return;

      setToasts((prev) => [...prev, toast]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== toast.id));
      }, 3500);
    };

    window.addEventListener('app-toast', handler as EventListener);
    return () => window.removeEventListener('app-toast', handler as EventListener);
  }, []);

  return (
    <div className="fixed inset-x-0 top-4 z-50 flex flex-col items-end gap-2 px-4 pointer-events-none sm:right-4 sm:left-auto">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto max-w-sm rounded-lg border px-4 py-3 shadow-xl transition-all duration-200 ease-out ${
            toast.type === 'error'
              ? 'bg-red-600 text-white border-red-700'
              : toast.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-700'
              : 'bg-slate-800 text-white border-slate-700'
          }`}
        >
          <p className="text-sm font-medium">{toast.message}</p>
        </div>
      ))}
    </div>
  );
}
