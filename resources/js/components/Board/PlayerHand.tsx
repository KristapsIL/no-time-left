import React, { useMemo } from 'react';
import { CardView } from '@/components/Board/CardView';
import { isValidPlay } from '@/utils/gameLogic';

type Props = {
  hand: string[];
  topCard: string | null;
  isMyTurn: boolean;
  playCard: (card: string) => void;
};

export const PlayerHand: React.FC<Props> = React.memo(({ hand, topCard, isMyTurn, playCard }) => {
  return (
    <div className="flex gap-2 flex-wrap justify-center">
      {hand.map((card, idx) => {
        const canPlay = isMyTurn && isValidPlay(card, topCard);
        return (
          <CardView
            key={`${card}-${idx}`}
            card={card}
            disabled={!canPlay}
            onClick={() => { if (canPlay) playCard(card); }}
          />
        );
      })}
    </div>
  );
});
