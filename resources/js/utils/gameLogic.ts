// Simple card split helper for game logic
const splitCard = (code: string): [string, string] => {
  const [v, s] = code.split('-', 2);
  return [v ?? '', s ?? ''];
};

/**
 * Returns whether `card` is a legal play.
 * When a pickup penalty is pending and stacking is enabled, only 2s may be played.
 * When a penalty is pending and stacking is disabled, nothing may be played.
 */
export const isValidPlay = (
  card: string,
  top: string | null,
  pickupPenalty = 0,
  stackingActive = false,
): boolean => {
  if (!top) return true;
  if (pickupPenalty > 0) {
    if (!stackingActive) return false;
    const [cv] = splitCard(card);
    return cv === '2'; // any 2 is valid when stacking
  }
  const [cv, cs] = splitCard(card);
  const [tv, ts] = splitCard(top);
  return cv === tv || cs === ts;
};

type Presence = { id?: string | number; user_id?: string | number };
export const uniqById = <T extends Presence>(arr: T[]): T[] => {
  const m = new Map<string | number, T>();
  for (const p of arr) {
    const key = p.id ?? p.user_id;
    if (key !== undefined) m.set(String(key), p);
  }
  return Array.from(m.values());
};