import React, {
  useMemo,
  useState,
  useCallback,
  useLayoutEffect,
  useRef,
  useEffect,
} from 'react';
import { CardView } from '@/components/Board/CardView';
import { isValidPlay } from '@/utils/gameLogic';

type Props = {
  hand: string[];
  topCard: string | null;
  isMyTurn: boolean;
  playCard: (card: string) => void;

  /** Left/right safe padding so cards never touch borders (px). Default: 64 */
  edgeGutter?: number;
  /** Card size (fixed; no scaling). Default: 110x160 */
  cardSize?: { w: number; h: number };
  /** Minimum visible sliver between cards (px). Default: 12 */
  minSliver?: number;
  /** Maximum step as a fraction of card width (≈ no overlap). Default: 0.95 */
  maxStepFrac?: number;
  /** How much neighbors shift on hover (px). Default: 16 */
  hoverSpread?: number;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Measure element with ResizeObserver (reacts to DevTools open/close, resizes, etc.) */
function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [sz, setSz] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const r = e.contentRect;
        setSz({ width: r.width, height: r.height });
      }
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, sz] as const;
}

export const PlayerHand: React.FC<Props> = React.memo(
  ({
    hand,
    topCard,
    isMyTurn,
    playCard,
    edgeGutter = 64,
    cardSize = { w: 110, h: 160 },
    minSliver = 12,
    maxStepFrac = 0.95,
    hoverSpread = 16,
  }) => {
    const [hovered, setHovered] = useState<number | null>(null);

    // Desktop content box (we apply gutters outside, then measure inside)
    const [boxRef, boxSize] = useElementSize<HTMLDivElement>();
    // Mobile strip measurement
    const [mobileRef, mobileSize] = useElementSize<HTMLDivElement>();

    // Fallback to recompute on window resize (some environments throttle RO)
    const [, force] = useState(0);
    useEffect(() => {
      const onResize = () => force((x) => x + 1);
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }, []);

    const {
      positions,        // card center positions (px)
      needsScroll,      // whether horizontal scroll is enabled
      scrollWidth,      // full content width for scroll container
      effW, effH,       // fixed card size
      containerH,       // desktop container height
      leftCenterBound,  // clamp bounds for centers
      rightCenterBound,
    } = useMemo(() => {
      const n = hand.length;
      const effW = cardSize.w;
      const effH = cardSize.h;

      // Width available inside gutters
      const usableW = Math.max(0, boxSize.width);

      // Compute step to fit at fixed size:
      // Content width = effW + stepX * (n - 1).
      // Clamp step to [minSliver, maxStep].
      const maxStep = Math.round(maxStepFrac * effW);
      let stepX = n > 1 ? Math.floor((usableW - effW) / (n - 1)) : 0;
      stepX = n > 1 ? clamp(stepX, minSliver, maxStep) : 0;

      const contentWidth = n > 0 ? effW + stepX * (n - 1) : 0;
      const needsScroll = contentWidth > usableW + 0.5;

      // Build positions as **centers** so first/last never clip
      let positions: number[] = [];
      let startCenter = 0;
      let totalSpan = stepX * Math.max(0, n - 1);

      if (n > 0) {
        if (needsScroll) {
          // Left-aligned scroll: first center at effW/2
          startCenter = effW / 2;
          positions = Array.from({ length: n }, (_, i) => startCenter + i * stepX);
        } else {
          // Centered: centers from -span/2 .. +span/2
          startCenter = -totalSpan / 2;
          positions = Array.from({ length: n }, (_, i) => startCenter + i * stepX);
        }
      }

      // Clamp bounds for centers to prevent hover-nudges from clipping
      const leftCenterBound = startCenter;
      const rightCenterBound = startCenter + totalSpan;

      // Scroll container width matches full content (+1px for rounding)
      const scrollWidth = Math.ceil(contentWidth) + 1;

      // Container height = card height + headroom for hover
      const containerH = Math.max(200, Math.ceil(effH + 24));

      return {
        positions,
        needsScroll,
        scrollWidth,
        effW,
        effH,
        containerH,
        leftCenterBound,
        rightCenterBound,
      };
    }, [hand.length, boxSize.width, cardSize.w, cardSize.h, minSliver, maxStepFrac]);

    const onKeyPlay = useCallback(
      (e: React.KeyboardEvent, canPlay: boolean, card: string) => {
        if (!canPlay) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          playCard(card);
        }
      },
      [playCard]
    );

    // Mobile overlap: adaptive; also never scales.
    const mobileOverlapPx = useMemo(() => {
      const n = hand.length;
      if (n <= 1) return 0;
      const cardW = 104; // mobile size you use
      const avail = Math.max(0, mobileSize.width - 24); // padding safety
      const minStep = Math.round(cardW * 0.35);
      const maxStep = cardW;
      const fitStep = clamp(Math.floor((avail - cardW) / Math.max(1, n - 1)), minStep, maxStep);
      return clamp(cardW - fitStep, Math.round(cardW * 0.15), Math.round(cardW * 0.85));
    }, [hand.length, mobileSize.width]);

    return (
      <div className="w-full select-none">
        {/* DESKTOP: gutters -> measured content box -> scroll if needed */}
        <div
          className="hidden sm:block w-full"
          style={{ paddingLeft: edgeGutter, paddingRight: edgeGutter }}
        >
          <div
            ref={boxRef}
            className="relative"
            style={{
              height: containerH,
              overflowX: 'hidden', // outer measured box doesn't scroll
              overflowY: 'hidden',
            }}
          >
            {/* Inner scroller when needed */}
            <div className="relative h-full overflow-x-auto overflow-y-hidden" style={{ width: '100%' }}>
              <div
                className="relative h-full"
                style={{ width: needsScroll ? `${scrollWidth}px` : '100%' }}
              >
                {/* Anchor: left for scrolling, centered otherwise */}
                <div
                  className={`absolute ${
                    needsScroll ? 'left-0' : 'left-1/2 -translate-x-1/2'
                  } bottom-3`}
                >
                  {positions.map((x, idx) => {
                    const card = hand[idx];
                    const canPlay = isMyTurn && isValidPlay(card, topCard);
                    const isHover = hovered === idx;

                    // Hover reveal: lift & neighbor "peek" shifts
                    const z = 200 + idx + (isHover ? 1000 : 0);
                    const lift = isHover ? 18 : 0;

                    // Neighbors nudge a bit away from hovered card
                    let nudge = 0;
                    if (hovered != null && hovered !== idx) {
                      const d = idx - hovered;
                      const sign = d < 0 ? -1 : 1;
                      const mag = Math.max(0, (hoverSpread ?? 16) / (Math.abs(d) + 1)); // 16, 8, 5, ...
                      nudge = sign * mag;
                    }

                    // Clamp nudge so center stays within safe bounds (prevents clipping)
                    const clampedCenter = clamp(x + nudge, leftCenterBound, rightCenterBound);

                    return (
                      <div
                        key={`${card}-${idx}`}
                        className="absolute will-change-transform transition-transform duration-150 ease-out"
                        style={{
                          left: 0,
                          bottom: 0,
                          // x is the **center**; -50% ensures 1st/last never clip
                          transform: `translateX(-50%) translateX(${clampedCenter.toFixed(
                            2
                          )}px) translateY(${-lift}px)`,
                          zIndex: z,
                        }}
                        onMouseEnter={() => setHovered(idx)}
                        onMouseLeave={() => setHovered(null)}
                      >
                        <CardView
                          card={card}
                          disabled={!canPlay}
                          selected={false}
                          onClick={() => {
                            if (canPlay) playCard(card);
                          }}
                          className={[
                            'shadow-lg transition-transform duration-150',
                            isHover ? 'scale-[1.06]' : '',
                            canPlay
                              ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-emerald-900 cursor-pointer focus:ring-2 focus:ring-yellow-300'
                              : 'opacity-95 cursor-not-allowed',
                          ].join(' ')}
                          style={{ width: cardSize.w, height: cardSize.h }} // fixed size, never scaled
                          tabIndex={canPlay ? 0 : -1}
                          onKeyDown={(e) => onKeyPlay(e, canPlay, card)}
                          aria-disabled={!canPlay}
                          aria-label={`${card}${canPlay ? ' (playable)' : ''}`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MOBILE: horizontal strip with adaptive overlap and snap */}
        <div
          ref={mobileRef}
          className="sm:hidden flex items-end overflow-x-auto px-4 pt-2 pb-[max(env(safe-area-inset-bottom),12px)] gap-1 snap-x snap-mandatory"
          role="listbox"
          aria-label="Your hand"
        >
          {hand.map((card, idx) => {
            const canPlay = isMyTurn && isValidPlay(card, topCard);
            return (
              <div
                key={`${card}-${idx}`}
                className="shrink-0 snap-start first:ml-0"
                style={{ marginLeft: idx === 0 ? 0 : -mobileOverlapPx }}
              >
                <CardView
                  card={card}
                  disabled={!canPlay}
                  selected={false}
                  onClick={() => {
                    if (canPlay) playCard(card);
                  }}
                  className={[
                    'shadow-md transition-transform active:-translate-y-1',
                    canPlay
                      ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-emerald-900 cursor-pointer focus:ring-2 focus:ring-yellow-300'
                      : 'opacity-95 cursor-not-allowed',
                  ].join(' ')}
                  style={{ width: 104, height: 150 }}
                  tabIndex={canPlay ? 0 : -1}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && canPlay) {
                      e.preventDefault();
                      playCard(card);
                    }
                  }}
                  aria-disabled={!canPlay}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);
