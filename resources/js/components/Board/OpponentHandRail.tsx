// resources/js/components/Board/OpponentHandRail.tsx
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
  // ---- SUPER COMPACT PRESETS ----
  const SIDE_WIDTH = 96;                 // very slim rails
  const SIDE_HEIGHT = 160;               // compact vertical slot for rotated hand
  const TOP_INLINE_SIZE = 'clamp(360px, 40cqi, 620px)'; // container-relative; needs [container-type:inline-size] on parent
  const TOP_BLOCK_SIZE = 150;            // top rail height

  const isSide = side !== 'top';

  // Smaller cards on both; extra small on sides
  const cardSize = isSide
    ? { w: 72, h: 106 }    // sides
    : { w: 88, h: 128 };   // top
  // Dense overlap; sides tighter than top
  const minSliver   = isSide ? 4   : 8;    // minimum visible slice of next card
  const maxStepFrac = isSide ? 0.45 : 0.75;

  const angle = side === 'left' ? -90 : side === 'right' ? 90 : 0;

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

        {/* Clipping wrapper prevents the rotated rail from overlapping neighbors */}
        <div
          className="relative overflow-hidden"
          style={{
            width:  isSide ? `${SIDE_WIDTH}px`  : TOP_INLINE_SIZE,
            height: isSide ?  SIDE_HEIGHT       : TOP_BLOCK_SIZE,
          }}
        >
          {/* Rotated inner plane; swap width/height for side rails */}
          <div
            className="absolute left-1/2 top-1/2"
            style={{
              transformOrigin: 'center',
              transform: `translate(-50%, -50%) rotate(${angle}deg)`,
              width:  isSide ? `${SIDE_HEIGHT}px` : '100%',
              height: isSide ? `${SIDE_WIDTH}px`  : '100%',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
            }}
          >
            {/* OtherPlayerHand measures pre-rotation size; packing controlled by minSliver/maxStepFrac */}
            <OtherPlayerHand
              handCount={handCount}
              isTurn={isTurn}
              cardSize={cardSize}
              minSliver={minSliver}
              maxStepFrac={maxStepFrac}
              allowScroll={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
};