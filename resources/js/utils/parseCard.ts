
export type ParsedCard = {
  rank: string;
  suit: '♠' | '♥' | '♦' | '♣';
  color: 'red' | 'black';
};

export function parseCard(card: string): ParsedCard | null {
  if (typeof card !== 'string') return null;
  const parts = card.split('-');
  if (parts.length !== 2) return null;
  const [rank, suitRaw] = parts as [string, string];
  const suit = suitRaw as ParsedCard['suit'];
  if (!['♠', '♥', '♦', '♣'].includes(suit)) return null;

  return {
    rank,
    suit,
    color: (suit === '♥' || suit === '♦') ? 'red' : 'black',
  }
}
