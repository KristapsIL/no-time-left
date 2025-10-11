import React from 'react';

// Deck.tsx
type DeckProps = {
  deckCount: number;
  isMyTurn: boolean;
  pickupCard: () => void;
};

export const Deck: React.FC<DeckProps> = React.memo(({ deckCount, isMyTurn, pickupCard }) => {
  const disabled = !isMyTurn;
  return (
    <button
      onClick={() => !disabled && pickupCard()}
      disabled={disabled}
      className={[
        'px-4 py-3 rounded bg-emerald-700 text-white',
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-emerald-800',
      ].join(' ')}
      title={!isMyTurn ? 'Wait your turn' : 'Draw a card'}
    >
      Deck ({deckCount})
    </button>
  )});