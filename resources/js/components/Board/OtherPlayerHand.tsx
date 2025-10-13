import React, { useMemo, useState, useLayoutEffect, useRef, useEffect } from 'react';
import { CardView } from '@/components/Board/CardView';

type Props = {
  handCount: number;          // Number of cards other player has
  isTurn: boolean;            // Highlight if it’s their turn
  edgeGutter?: number;
  cardSize?: { w: number; h: number };
  minSliver?: number;
  maxStepFrac?: number;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [sz, setSz] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setSz({ width: e.contentRect.width, height: e.contentRect.height });
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, sz] as const;
}

export const OtherPlayerHand: React.FC<Props> = ({
  handCount,
  isTurn,
  edgeGutter = 32,
  cardSize = { w: 110, h: 160 },
  minSliver = 12,
  maxStepFrac = 0.95,
}) => {
  const [boxRef, boxSize] = useElementSize<HTMLDivElement>();

  const { positions, needsScroll, scrollWidth, containerH, leftCenterBound, rightCenterBound } = useMemo(() => {
    const n = handCount;
    const effW = cardSize.w;
    const effH = cardSize.h;

    const usableW = Math.max(0, boxSize.width);
    const maxStep = Math.round(maxStepFrac * effW);
    let stepX = n > 1 ? Math.floor((usableW - effW) / (n - 1)) : 0;
    stepX = n > 1 ? clamp(stepX, minSliver, maxStep) : 0;

    const contentWidth = n > 0 ? effW + stepX * (n - 1) : 0;
    const needsScroll = contentWidth > usableW + 0.5;

    let positions: number[] = [];
    const totalSpan = stepX * Math.max(0, n - 1);
    let startCenter = 0;

    if (n > 0) {
      if (needsScroll) {
        startCenter = effW / 2;
        positions = Array.from({ length: n }, (_, i) => startCenter + i * stepX);
      } else {
        startCenter = -totalSpan / 2;
        positions = Array.from({ length: n }, (_, i) => startCenter + i * stepX);
      }
    }

    return {
      positions,
      needsScroll,
      scrollWidth: Math.ceil(contentWidth) + 1,
      containerH: Math.max(200, Math.ceil(effH + 24)),
      leftCenterBound: startCenter,
      rightCenterBound: startCenter + totalSpan,
    };
  }, [handCount, boxSize.width, cardSize.w, cardSize.h, minSliver, maxStepFrac]);

  return (
    <div className="w-full select-none">
      <div ref={boxRef} className="relative" style={{ height: containerH, overflowX: 'hidden' }}>
        <div className="relative h-full overflow-x-auto overflow-y-hidden" style={{ width: '100%' }}>
          <div className="relative h-full" style={{ width: needsScroll ? `${scrollWidth}px` : '100%' }}>
            <div className={`absolute ${needsScroll ? 'left-0' : 'left-1/2 -translate-x-1/2'} bottom-0`}>
              {positions.map((x, idx) => {
                const z = 200 + idx;
                const clampedCenter = clamp(x, leftCenterBound, rightCenterBound);
                return (
                  <div
                    key={idx}
                    className="absolute"
                    style={{
                      left: 0,
                      bottom: 0,
                      transform: `translateX(-50%) translateX(${clampedCenter.toFixed(2)}px)`,
                      zIndex: z,
                    }}
                  >
                    <CardView
                      card="yo" // Always show back
                      disabled={true}
                      selected={false}
                      className={`shadow-lg ${isTurn ? 'ring-2 ring-yellow-300' : ''}`}
                      style={{ width: cardSize.w, height: cardSize.h }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
