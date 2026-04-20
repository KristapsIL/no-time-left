// Simple card split helper for game logic
const splitCard = (code: string): [string, string] => {
  const [v, s] = code.split('-', 2);
  return [v ?? '', s ?? ''];
};

export const isValidPlay = (card: string, top: string | null): boolean => {
  if (!top) return true;
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