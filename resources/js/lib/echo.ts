// bootstrap/echo.ts (or similar)
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

declare global {
  interface Window {
    Pusher?: typeof Pusher;     // keep optional (safer for SSR)
    Echo?: Echo<'pusher'>;      // <-- pass the broadcaster key here
  }
}

window.Pusher = Pusher;

// CSRF helper
const csrfToken =
  (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';

const echo = new Echo<'pusher'>({
  broadcaster: 'pusher',                     // matches the generic above
  key: import.meta.env.VITE_PUSHER_APP_KEY,
  cluster: import.meta.env.VITE_PUSHER_APP_CLUSTER,
  forceTLS: true,

  // Presence/private channel auth (Laravel default)
  authEndpoint: '/broadcasting/auth',
  auth: { headers: { 'X-CSRF-TOKEN': csrfToken } },
});

window.Echo = echo;
export default echo;
