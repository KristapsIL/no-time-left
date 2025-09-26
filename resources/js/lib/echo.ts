// bootstrap/echo.ts
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

declare global {
  interface Window { Echo?: Echo<'pusher'>; Pusher?: typeof Pusher; }
}

if (!window.Echo) {
  window.Pusher = Pusher;
  const csrf = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';
  window.Echo = new Echo<'pusher'>({
    broadcaster: 'pusher',
    key: import.meta.env.VITE_PUSHER_APP_KEY,
    cluster: import.meta.env.VITE_PUSHER_APP_CLUSTER,
    forceTLS: true,
    authEndpoint: '/broadcasting/auth',
    auth: { headers: { 'X-CSRF-TOKEN': csrf } },
    // optional: reduce noise
    enabledTransports: ['ws', 'wss'],
  });
}

export default window.Echo!;

