import React from 'react';
import { CardBack } from '@/components/Board/CardBack';

type DeckProps = {
  isMyTurn: boolean;
  pickupCard: () => void;
};

export const Deck: React.FC<DeckProps> = React.memo(({ isMyTurn, pickupCard }) => {
  const disabled = !isMyTurn;

  return (
    <button
      onClick={() => !disabled && pickupCard()}
      disabled={disabled}
      className={[
        'relative select-none',
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 transition-transform',
      ].join(' ')}
      style={{
        padding: 0,
        border: 'none',
        background: 'transparent',
        position: 'relative',
        width: 90,
        height: 130,
      }}
      title={!isMyTurn ? 'Wait your turn' : 'Draw a card'}
    >
      {/* Stack effect */}
      <div className="absolute" style={{ top: 4, left: 4, zIndex: 1 }}>
        <CardBack width={80} height={120} fillColor="#1f2937" bandColor="#0ea5e9" rimColor="rgba(0,0,0,0.35)" label="" />
      </div>
      <div className="absolute" style={{ top: 2, left: 2, zIndex: 2 }}>
        <CardBack width={80} height={120} fillColor="#1f2937" bandColor="#0ea5e9" rimColor="rgba(0,0,0,0.35)" label="" />
      </div>
      <div className="absolute" style={{ top: 0, left: 0, zIndex: 3 }}>
        <CardBack width={80} height={120} fillColor="#1f2937" bandColor="#0ea5e9" rimColor="rgba(0,0,0,0.35)" label="" />
      </div>
    </button>
  );
});
