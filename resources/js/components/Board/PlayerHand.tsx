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

  edgeGutter?: number;

  cardSize?: { w: number; h: number };
  minSliver?: number;
  maxStepFrac?: number;
  hoverSpread?: number;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

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

    const [boxRef, boxSize] = useElementSize<HTMLDivElement>();
    const [mobileRef, mobileSize] = useElementSize<HTMLDivElement>();

    const [, force] = useState(0);
    useEffect(() => {
      const onResize = () => force((x) => x + 1);
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }, []);

    const {
      positions,
      needsScroll,
      scrollWidth,
      containerH,
      leftCenterBound,
      rightCenterBound,
    } = useMemo(() => {
      const n = hand.length;
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

      const leftCenterBound = startCenter;
      const rightCenterBound = startCenter + totalSpan;
      const scrollWidth = Math.ceil(contentWidth) + 1;
      const containerH = Math.max(200, Math.ceil(effH + 24));

      return {
        positions,
        needsScroll,
        scrollWidth,
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

    const mobileOverlapPx = useMemo(() => {
      const n = hand.length;
      if (n <= 1) return 0;
      const cardW = 104;
      const avail = Math.max(0, mobileSize.width - 24);
      const minStep = Math.round(cardW * 0.35);
      const maxStep = cardW;
      const fitStep = clamp(Math.floor((avail - cardW) / Math.max(1, n - 1)), minStep, maxStep);
      return clamp(cardW - fitStep, Math.round(cardW * 0.15), Math.round(cardW * 0.85));
    }, [hand.length, mobileSize.width]);

    return (
      <div className="w-full select-none">
        {/* Desktop */}
        <div
          className="hidden sm:block w-full"
          style={{ paddingLeft: edgeGutter, paddingRight: edgeGutter }}
        >
          <div
            ref={boxRef}
            className="relative"
            style={{
              height: containerH,
              overflowX: 'hidden',
              overflowY: 'hidden',
            }}
          >
            <div className="relative h-full overflow-x-auto overflow-y-hidden" style={{ width: '100%' }}>
              <div
                className="relative h-full"
                style={{ width: needsScroll ? `${scrollWidth}px` : '100%' }}
              >
                <div
                  className={`absolute ${
                    needsScroll ? 'left-0' : 'left-1/2 -translate-x-1/2'
                  } bottom-3`}
                >
                  {positions.map((x, idx) => {
                    const card = hand[idx];
                    const canPlay = isMyTurn && isValidPlay(card, topCard);
                    const isHover = hovered === idx;

                    const z = 200 + idx + (isHover ? 1000 : 0);
                    const lift = isHover ? 18 : 0;

                    let nudge = 0;
                    if (hovered != null && hovered !== idx) {
                      const d = idx - hovered;
                      const sign = d < 0 ? -1 : 1;
                      const mag = Math.max(0, (hoverSpread ?? 16) / (Math.abs(d) + 1));
                      nudge = sign * mag;
                    }

                    const clampedCenter = clamp(x + nudge, leftCenterBound, rightCenterBound);

                    return (
                      <div
                        key={`${card}-${idx}`}
                        className="absolute will-change-transform transition-transform duration-150 ease-out"
                        style={{
                          left: 0,
                          bottom: 0,
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
                              : ' cursor-not-allowed',
                          ].join(' ')}
                          style={{ width: cardSize.w, height: cardSize.h }}
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

        {/* Mobile */}
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