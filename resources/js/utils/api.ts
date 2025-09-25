import echo from '@/lib/echo';

const getCsrf = () =>
  document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';

/** Get a non-empty socket id (or undefined) so we can omit the header when not connected */
const getSocketId = () => {
  const id = echo?.socketId?.();
  return id && typeof id === 'string' && id.length > 0 ? id : undefined;
};

/** Merge headers safely and omit empty X-Socket-Id */
const buildHeaders = (extra?: HeadersInit): HeadersInit => {
  const socketId = getSocketId();
  return {
    'Accept': 'application/json',
    'X-CSRF-TOKEN': getCsrf(),
    ...(socketId ? { 'X-Socket-Id': socketId } : {}),
    ...(extra ?? {}),
  };
};

/** Robust parser for API responses */
async function parseApiResponse<T = unknown>(res: Response, opts?: { allowEmpty?: boolean }): Promise<T | void> {
  const contentType = res.headers.get('content-type') ?? '';

  // If redirected (often to /login), surface that clearly
  if (res.redirected) {
    const text = await res.text();
    throw new Error(`Redirected to ${res.url}. Body: ${text.slice(0, 200)}…`);
  }

  // 204 No Content
  if (res.status === 204 || (opts?.allowEmpty && res.status === 200 && !contentType)) return;

  if (contentType.includes('application/json')) {
    const payload = (await res.json()) as T;
    if (!res.ok) throw payload;
    return payload;
  }

  // Anything else (HTML, plain text, etc.)
  const txt = await res.text();
  throw new Error(`Non-JSON response (status ${res.status}). CT=${contentType}. Body: ${txt.slice(0, 200)}…`);
}

/** POST /board/{roomId}/play-card  -> currently returns 204 on success */
export const playCardApi = async (roomId: number, card: string) => {
  const res = await fetch(`/board/${roomId}/play-card`, {
    method: 'POST',
    headers: buildHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ card }),
  });
  return parseApiResponse(res, { allowEmpty: true }); // server returns no content on success
};

/** PUT /board/{roomId}/pickup  -> adjust allowEmpty depending on your controller */
export const pickupCardApi = async <T = unknown>(roomId: number) => {
  const res = await fetch(`/board/${roomId}/pickup`, {
    method: 'PUT',
    headers: buildHeaders({ 'Content-Type': 'application/json' }),
  });
  return parseApiResponse<T>(res); // if your endpoint returns 204, pass { allowEmpty: true }
};

/** GET /board/{roomId}/resync-state  -> expects JSON payload */
export const resyncStateApi = async <T = unknown>(roomId: number) => {
  const res = await fetch(`/board/${roomId}/resync-state`, { headers: buildHeaders() });
  return parseApiResponse<T>(res);
};
