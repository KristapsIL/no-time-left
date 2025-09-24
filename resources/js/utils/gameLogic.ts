export const parseCard = (code: string): [string, string] => {
  const [v, s] = code.split('-', 2);
  return [v ?? '', s ?? ''];
};

export const isValidPlay = (card: string, top: string | null): boolean => {
  if (!top) return true;
  const [cv, cs] = parseCard(card);
  const [tv, ts] = parseCard(top);
  return cv === tv || cs === ts;
};

export const uniqById = (arr: any[]) => {
  const m = new Map<string | number, any>();
  for (const p of arr) m.set(p.id ?? p.user_id ?? p, p);
  return Array.from(m.values());
};