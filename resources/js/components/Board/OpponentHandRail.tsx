// resources/js/components/Board/OpponentHandRail.tsx
import React from 'react';
import { OtherPlayerHand } from './OtherPlayerHand';
import { CardBack } from '@/components/Board/CardBack';

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
  // ── Side rails: simple vertical card stack, no rotation needed ───────────
  if (side !== 'top') {
    const MAX_VIS = 7;
    const CARD_W = 58;
    const CARD_H = 84;
    const STEP = 13;
    const show = Math.max(1, Math.min(handCount, MAX_VIS));
    const stackH = CARD_H + (show - 1) * STEP;

    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2 py-2 min-w-0">
        {label && (
          <div
            className={[
              'px-1.5 py-0.5 rounded text-[10px] font-medium text-center select-none leading-tight',
              'max-w-[110px] truncate',
              isTurn ? 'bg-yellow-400 text-black' : 'bg-black/30 text-white',
            ].join(' ')}
          >
            {label}
          </div>
        )}
        <div className="relative" style={{ width: CARD_W, height: stackH }}>
          {Array.from({ length: show }, (_, i) => (
            <div key={i} className="absolute" style={{ top: i * STEP, zIndex: i }}>
              <CardBack
                width={CARD_W}
                height={CARD_H}
                fillColor="#1f2937"
                bandColor="#0ea5e9"
                rimColor="rgba(0,0,0,0.35)"
                label=""
              />
            </div>
          ))}
        </div>
        {handCount > MAX_VIS && (
          <span className="text-[10px] text-white/40 leading-none">+{handCount - MAX_VIS}</span>
        )}
      </div>
    );
  }

  // ── Top rail: horizontal fan ─────────────────────────────────────────────
  const TOP_INLINE_SIZE = 'clamp(280px, 40cqi, 620px)';
  const TOP_BLOCK_SIZE = 150;

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