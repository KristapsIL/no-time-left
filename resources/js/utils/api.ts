// utils/api.ts
import echo from '@/lib/echo';
import { getTypedEcho } from '@/types/echo';

const getCsrf = () =>
  document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';

const getSocketHeaders = (): Record<string, string> => {
  const typedEcho = getTypedEcho(echo);
  const socketId = typedEcho?.socketId() ?? null;
  return socketId ? { 'X-Socket-Id': socketId } : {};
};

async function parseJsonSafe(res: Response): Promise<any | null> {
  // 204 No Content or explicit empty body → null
  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') || '';
  try {
    if (ct.includes('application/json')) {
      return await res.json();
    } else {
      // Not JSON; try text and wrap it so we can inspect on error
      const txt = await res.text();
      return txt ? { __raw: txt } : null;
    }
  } catch {
    return null; // empty or invalid JSON body
  }
}

function buildError(res: Response, body: any): Error {
  const msg =
    (body && (body.message || body.error || body.errors)) ||
    res.statusText ||
    'Request failed';
  const err: any = new Error(typeof msg === 'string' ? msg : 'Request failed');
  err.status = res.status;
  err.body = body;
  return err;
}

export const playCardApi = async (roomId: number, card: string) => {
  const res = await fetch(`/board/${roomId}/play-card`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-CSRF-TOKEN': getCsrf(),
      ...getSocketHeaders(),
    },
    body: JSON.stringify({ card }),
  });

  const body = await parseJsonSafe(res);
  if (!res.ok) throw buildError(res, body);
  return body ?? {};
};

export const pickupCardApi = async (roomId: number) => {
  const res = await fetch(`/board/${roomId}/pickup`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-CSRF-TOKEN': getCsrf(),
      ...getSocketHeaders(),
    },
  });

  const body = await parseJsonSafe(res);
  if (!res.ok) throw buildError(res, body);
  return body ?? {};
};

export const passTurnApi = async (roomId: number) => {
  const res = await fetch(`/board/${roomId}/pass-turn`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-CSRF-TOKEN': getCsrf(),
      ...getSocketHeaders(),
    },
  });

  const body = await parseJsonSafe(res);
  if (!res.ok) throw buildError(res, body);
  return body ?? {};
};

export const resyncStateApi = async (roomId: number) => {
  const res = await fetch(`/board/${roomId}/resync-state`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-CSRF-TOKEN': getCsrf(),
      ...getSocketHeaders(),
    },
    cache: 'no-store',
  });

  const body = await parseJsonSafe(res);
  if (!res.ok) throw buildError(res, body);
  return body ?? {};
};

export const resetGameApi = async (roomId: number) => {
  const res = await fetch(`/board/${roomId}/reset`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-CSRF-TOKEN': getCsrf(),
      ...getSocketHeaders(),
    },
  });

  const body = await parseJsonSafe(res);
  if (!res.ok) throw buildError(res, body);
  return body ?? {};
};

export const startGameApi = async (roomId: number) => {
  const res = await fetch(`/board/${roomId}/start-game`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-CSRF-TOKEN': getCsrf(),
      ...getSocketHeaders(),
    },
  });

  const body = await parseJsonSafe(res);
  if (!res.ok) throw buildError(res, body);
  return body ?? {};
};

export const updateRoomSettingsApi = async (
  roomId: number,
  settings: {
    max_players?: number;
    turn_timeout_seconds?: number;
    bot_fill_count?: number;
    rules?: string[];
  },
) => {
  const res = await fetch(`/board/${roomId}/room-settings`, {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-CSRF-TOKEN': getCsrf(),
    },
    body: JSON.stringify(settings),
  });

  const body = await parseJsonSafe(res);
  if (!res.ok) throw buildError(res, body);
  return body ?? {};
};

