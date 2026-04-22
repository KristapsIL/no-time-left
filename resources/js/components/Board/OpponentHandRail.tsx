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
  // ── Side rails: rotated horizontal fan ───────────────────────────────────
  if (side !== 'top') {
    // The fan is the same card size as the top rail (88×128).
    // We rotate a wide-but-short div 90° so it appears tall-but-narrow inside
    // the 130/150px column. "FAN_W" becomes the visual height; "CARD_H + gap"
    // becomes the visual width (which should fit inside the column).
    const CARD_W  = 88;
    const CARD_H  = 128;
    const FAN_W   = 300;   // virtual width → becomes visual height
    const FAN_H   = CARD_H + 20; // virtual height → becomes visual width (~148px)
    const rot     = side === 'left' ? '90deg' : '-90deg';

    return (
      <div
        className="w-full h-full flex flex-col items-center justify-start gap-1.5 py-2"
        style={{ overflow: 'visible' }}
      >
        {/* Label — always upright, above the fan */}
        {label && (
          <div
            className={[
              'px-1.5 py-0.5 rounded text-[10px] font-medium text-center select-none leading-tight',
              'max-w-[120px] truncate',
              isTurn ? 'bg-yellow-400 text-black ring-2 ring-yellow-300/60' : 'bg-black/30 text-white',
            ].join(' ')}
          >
            {label}
          </div>
        )}

        {/* Rotated fan */}
        <div
          className="relative flex-1 w-full"
          style={{ overflow: 'visible', minHeight: 60 }}
        >
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: FAN_W,
              height: FAN_H,
              transform: `translate(-50%, -50%) rotate(${rot})`,
              overflow: 'visible',
            }}
          >
            <OtherPlayerHand
              handCount={handCount}
              isTurn={isTurn}
              cardSize={{ w: CARD_W, h: CARD_H }}
              minSliver={8}
              maxStepFrac={0.75}
              allowScroll={false}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Top rail: horizontal fan ─────────────────────────────────────────────
  const TOP_INLINE_SIZE = 'clamp(280px, 40cqi, 620px)';
  const TOP_BLOCK_SIZE  = 150;

  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        {label && (
          <div
            className={[
              'px-2 py-0.5 rounded text-xs font-medium select-none',
              isTurn ? 'bg-yellow-400 text-black' : 'bg-black/30 text-white',
            ].join(' ')}
          >
            {label}
          </div>
        )}
        <div style={{ width: TOP_INLINE_SIZE, height: TOP_BLOCK_SIZE }}>
          <OtherPlayerHand
            handCount={handCount}
            isTurn={isTurn}
            cardSize={{ w: 88, h: 128 }}
            minSliver={8}
            maxStepFrac={0.75}
            allowScroll={false}
          />
        </div>
      </div>
    </div>
  );
};
