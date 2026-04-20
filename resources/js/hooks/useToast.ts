/**
 * Simple toast notification hook.
 * Emits browser events that are consumed by ToastHost.
 */

type ToastType = 'success' | 'error' | 'loading';

type ToastEventPayload = {
  id: string;
  type: ToastType;
  message: string;
};

const emitToast = (type: ToastType, message: string) => {
  const event = new CustomEvent<ToastEventPayload>('app-toast', {
    detail: {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type,
      message,
    },
  });
  window.dispatchEvent(event);
};

export const useToast = () => {
  return {
    success: (message: string) => emitToast('success', message),
    error: (message: string) => emitToast('error', message),
    loading: (message: string) => emitToast('loading', message),
    promise: async <T,>(promise: Promise<T>, messages: { loading: string; success: string; error: string }) => {
      emitToast('loading', messages.loading);
      try {
        const result = await promise;
        emitToast('success', messages.success);
        return result;
      } catch (err) {
        emitToast('error', messages.error);
        throw err;
      }
    },
  };
};
