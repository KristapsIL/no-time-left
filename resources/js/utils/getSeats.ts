// utils/getSeats.ts
export type PlayerLite = { id: string; name?: string };

export type Seats = {
  left: PlayerLite | null;
  top: PlayerLite | null;
  right: PlayerLite | null;
  overflow: PlayerLite[];
};

export function getSeats(connectedPlayers: PlayerLite[], userId: string): Seats {
  if (!connectedPlayers?.length || !userId) {
    return { left: null, top: null, right: null, overflow: [] };
  }

  const selfIdx = connectedPlayers.findIndex((p) => p.id === userId);
  if (selfIdx === -1) {
    return { left: null, top: null, right: null, overflow: [] };
  }

  // Build clockwise list of opponents starting after self
  const n = connectedPlayers.length;
  const opponents: PlayerLite[] = [];
  for (let i = 1; i < n; i++) {
    opponents.push(connectedPlayers[(selfIdx + i) % n]);
  }

  // --- Special cases ---
  if (opponents.length === 0) {
    // Solo, no seats
    return { left: null, top: null, right: null, overflow: [] };
  }

  if (opponents.length === 1) {
    // Two players total -> put the only opponent on TOP
    return { left: null, top: opponents[0], right: null, overflow: [] };
  }

  if (opponents.length === 2) {
    // Three players total -> left & right feel natural (no top)
    return { left: opponents[0], top: null, right: opponents[1], overflow: [] };
  }

  // 4+ players -> left, top, right, overflow the rest
  return {
    left: opponents[0] ?? null,
    top: opponents[1] ?? null,
    right: opponents[2] ?? null,
    overflow: opponents.slice(3),
  };
}