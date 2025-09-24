import React from 'react';
import { isValidPlay } from '@/utils/gameLogic';

type Props = {
  hand: string[];
  topCard: string | null;
  isMyTurn: boolean;
  playCard: (card: string) => void;
};

export const PlayerHand = ({ hand, topCard, isMyTurn, playCard }: Props) => (
  <div className="flex gap-3 flex-wrap justify-center mt-6">
    {hand.length === 0 && (
      <div className="text-white/80 text-sm italic">You have no cards.</div>
    )}
    {hand.map(card => {
      const playable = isValidPlay(card, topCard);
      const disabled = !isMyTurn || !playable;
      return (
        <button
          key={card}
          onClick={() => playCard(card)}
          disabled={disabled}
          className={`w-20 h-28 rounded-lg border shadow-lg flex items-center justify-center text-lg font-bold transition-transform
                     ${disabled
                       ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                       : 'bg-white text-black cursor-pointer hover:scale-105'}
                     ${isMyTurn ? 'ring-1 ring-yellow-400' : ''}`}
          title={isMyTurn ? (playable ? 'Play this card' : 'Card does not match value/suit') : 'Not your turn'}
        >
          {card}
        </button>
      );
    })}
  </div>
);
