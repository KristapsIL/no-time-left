import React from 'react';

type Props = {
  deckCount: number;
  isMyTurn: boolean;
  pickupCard: () => void;
};

export const Deck = ({ deckCount, isMyTurn, pickupCard }: Props) => (
  <div className="relative w-20 h-28">
    <div
      className={`absolute w-full h-full rounded-lg border shadow-md flex items-center justify-center text-white text-xl cursor-pointer
                  ${isMyTurn ? 'bg-gray-800 hover:scale-105 transition-transform' : 'bg-gray-700 cursor-not-allowed opacity-70'}`}
      onClick={() => isMyTurn && pickupCard()}
      title={isMyTurn ? 'Pick up a card' : 'Wait for your turn'}
    >
      🂠
    </div>
    <p className="text-white text-center mt-2 text-sm">{deckCount} left</p>
  </div>
);
