import echo from '@/lib/echo';

const getCsrf = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';

export const playCardApi = async (roomId: number, card: string) => {
  const res = await fetch(`/board/${roomId}/play-card`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-TOKEN': getCsrf(),
      'X-Socket-Id': (echo as any)?.socketId?.() ?? '',
    },
    body: JSON.stringify({ card }),
  });
  if (!res.ok) throw await res.json();
  return res.json();
};

export const pickupCardApi = async (roomId: number) => {
  const res = await fetch(`/board/${roomId}/pickup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-TOKEN': getCsrf(),
      'X-Socket-Id': (echo as any)?.socketId?.() ?? '',
    },
  });
  if (!res.ok) throw await res.json();
  return res.json();
};


export const resyncStateApi = async (roomId: number) => {
  const res = await fetch(`/board/${roomId}/resync-state`, {
    headers: {
      'X-CSRF-TOKEN': getCsrf(),
      'X-Socket-Id': (echo as any)?.socketId?.() ?? '',
    },
  });

  if (!res.ok) throw await res.json();
  return res.json();
};

