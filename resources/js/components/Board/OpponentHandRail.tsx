// components/Board/OpponentHandRail.tsx
import React from 'react';
import { OtherPlayerHand } from './OtherPlayerHand';

type OpponentHandRailProps = {
  side: 'left' | 'top' | 'right';
  handCount: number;
  isTurn: boolean;
  label?: React.ReactNode;
};

export const OpponentHandRail: React.FC<OpponentHandRailProps> = ({
  side,
  handCount,
  isTurn,
  label,
}) => {
  // Rotation for side rails; top stays horizontal
  const rotation =
    side === 'left' ? '-rotate-90' : side === 'right' ? 'rotate-90' : '';

  // Sizing presets per side (tweak to taste)
  const cardSize =
    side === 'top'
      ? { w: 100, h: 145 }
      : { w: 96, h: 140 }; // slightly smaller on sides

  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        {label ? (
          <div
            className={[
              'px-2 py-0.5 rounded text-xs font-medium select-none',
              isTurn ? 'bg-yellow-400 text-black' : 'bg-black/30 text-white',
            ].join(' ')}
          >
            {label}
          </div>
        ) : null}

        <div
          className={[
            'relative',
            'transition-shadow',
            rotation,
          ].join(' ')}
          style={{
            // Constrain width for the rail; OtherPlayerHand measures width pre-rotation
            width: side === 'top' ? 'min(960px, 95vw)' : '340px',
            height: side === 'top' ? '200px' : '240px',
          }}
        >
          <OtherPlayerHand handCount={handCount} isTurn={isTurn} cardSize={cardSize} />
        </div>
      </div>
    </div>
  );
}