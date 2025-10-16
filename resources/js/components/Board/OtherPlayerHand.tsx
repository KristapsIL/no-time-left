// resources/js/components/Board/OtherPlayerHand.tsx
import React, { useMemo, useState, useLayoutEffect, useRef } from 'react';
import { CardBack } from '@/components/Board/CardBack';

type Props = {
  handCount: number;
  isTurn: boolean;
  edgeGutter?: number;
  cardSize?: { w: number; h: number };
  minSliver?: number;
  maxStepFrac?: number;
  /** NEW: disable horizontal scrolling and just clip overflow */
  allowScroll?: boolean; // <- add
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
  isTurn, // eslint-disable-line @typescript-eslint/no-unused-vars
  edgeGutter = 32,
  cardSize = { w: 110, h: 160 },
  minSliver = 12,
  maxStepFrac = 0.95,
  allowScroll = true,             // <- default
}) => {
  const [boxRef, boxSize] = useElementSize<HTMLDivElement>();

  const {
    positions, needsScroll, scrollWidth, containerH, leftCenterBound, rightCenterBound,
  } = useMemo(() => {
    const n = handCount;
    const effW = cardSize.w;
    const effH = cardSize.h;

    const usableW = Math.max(0, boxSize.width);
    const maxStep = Math.round(maxStepFrac * effW);
    let stepX = n > 1 ? Math.floor((usableW - effW) / (n - 1)) : 0;
    stepX = n > 1 ? clamp(stepX, minSliver, maxStep) : 0;

    const contentWidth = n > 0 ? effW + stepX * (n - 1) : 0;
    // Only allow scrolling when explicitly allowed
    const needsScroll = allowScroll && contentWidth > usableW + 0.5;

    let positions: number[] = [];
    const totalSpan = stepX * Math.max(0, n - 1);
    let startCenter = 0;

    if (n > 0) {
      if (needsScroll) {
        startCenter = effW / 2;
        positions = Array.from({ length: n }, (_, i) => startCenter + i * stepX);
      } else {
        // Center the fan; excess will be clipped by parent if it overflows
        startCenter = -totalSpan / 2;
        positions = Array.from({ length: n }, (_, i) => startCenter + i * stepX);
      }
    }

    return {
      positions,
      needsScroll,
      scrollWidth: Math.ceil(contentWidth) + 1,
      containerH: Math.max(160, Math.ceil(effH + 24)),
      leftCenterBound: startCenter,
      rightCenterBound: startCenter + totalSpan,
    };
  }, [handCount, boxSize.width, cardSize.w, cardSize.h, minSliver, maxStepFrac, allowScroll]);

  return (
    <div className="w-full select-none">
      <div ref={boxRef} className="relative" style={{ height: containerH, overflowX: 'hidden' }}>
        <div
          className={`relative h-full overflow-y-hidden ${needsScroll ? 'overflow-x-auto' : ''}`}
          style={{
            width: '100%',
            overflowX: needsScroll ? 'auto' : ('clip' as const), // <- clip when no scroll
            overscrollBehaviorX: 'contain',
          }}
        >
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
                    <CardBack
                      width={cardSize.w}
                      height={cardSize.h}
                      fillColor="#1f2937"
                      bandColor="#0ea5e9"
                      rimColor="rgba(0,0,0,0.35)"
                      label=""
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