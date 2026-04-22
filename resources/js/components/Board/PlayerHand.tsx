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

    // ── Draw animation: detect newly added cards ──────────────────────────
    const prevHandRef = useRef<string[]>(hand);
    const [newCardAnimData, setNewCardAnimData] = useState<Map<number, number>>(new Map()); // index → stagger order
    const clearAnimTimerRef = useRef<number | null>(null);

    // Inject CSS keyframe once
    useEffect(() => {
      const id = 'deal-card-kf';
      if (!document.getElementById(id)) {
        const s = document.createElement('style');
        s.id = id;
        s.textContent = `@keyframes dealCard{from{opacity:0;transform:translateY(22px) scale(.9)}to{opacity:1;transform:translateY(0) scale(1)}}`;
        document.head.appendChild(s);
      }
    }, []);

    useLayoutEffect(() => {
      const prev = prevHandRef.current;
      prevHandRef.current = hand;

      if (hand.length > prev.length) {
        // Find newly added card indices
        const counts = new Map<string, number>();
        for (const c of prev) counts.set(c, (counts.get(c) ?? 0) + 1);

        const addedIndices: number[] = [];
        for (let i = 0; i < hand.length; i++) {
          const c = hand[i];
          const cnt = counts.get(c) ?? 0;
          if (cnt === 0) {
            addedIndices.push(i);
          } else {
            counts.set(c, cnt - 1);
          }
        }

        if (addedIndices.length > 0) {
          const animMap = new Map<number, number>();
          addedIndices.forEach((handIdx, order) => animMap.set(handIdx, order));
          setNewCardAnimData(animMap);

          if (clearAnimTimerRef.current !== null) window.clearTimeout(clearAnimTimerRef.current);
          clearAnimTimerRef.current = window.setTimeout(() => {
            setNewCardAnimData(new Map());
            clearAnimTimerRef.current = null;
          }, addedIndices.length * 260 + 600);
        }
      } else if (hand.length < prev.length) {
        setNewCardAnimData(new Map());
        if (clearAnimTimerRef.current !== null) {
          window.clearTimeout(clearAnimTimerRef.current);
          clearAnimTimerRef.current = null;
        }
      }
    }, [hand]);

    // ── Mobile card constants ─────────────────────────────────────────────
    const MOBILE_CARD_W = 70;
    const MOBILE_CARD_H = 104;
    const MOBILE_LIFT_PX = 46;

    // Absolute X positions so all cards fit in the container, no scroll
    const mobilePositions = useMemo(() => {
      const n = hand.length;
      if (n === 0) return [];
      const containerW = mobileSize.width || 320;
      const minStep = 14;
      const maxStep = MOBILE_CARD_W - 2;
      const step = n > 1
        ? clamp((containerW - MOBILE_CARD_W) / (n - 1), minStep, maxStep)
        : 0;
      return Array.from({ length: n }, (_, i) => i * step);
    }, [hand.length, mobileSize.width]);

    // ── Mobile drag-to-play (no scroll, immediate capture) ────────────────
    const [dragIdx, setDragIdx] = useState<number | null>(null);

    const computeCardIdxFromX = useCallback(
      (clientX: number) => {
        const container = mobileRef.current;
        if (!container || mobilePositions.length === 0) return null;
        const rect = container.getBoundingClientRect();
        const relX = clientX - rect.left;
        // Find card whose centre is nearest to touch point
        let best = 0;
        let bestDist = Infinity;
        for (let i = 0; i < mobilePositions.length; i++) {
          const centre = mobilePositions[i] + MOBILE_CARD_W / 2;
          const dist = Math.abs(relX - centre);
          if (dist < bestDist) { bestDist = dist; best = i; }
        }
        return best;
      },
      [mobilePositions]
    );

    const onMobilePointerDown = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragIdx(computeCardIdxFromX(e.clientX));
      },
      [computeCardIdxFromX]
    );

    const onMobilePointerMove = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        setDragIdx(computeCardIdxFromX(e.clientX));
      },
      [computeCardIdxFromX]
    );

    const onMobilePointerUp = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        const playIdx = computeCardIdxFromX(e.clientX);
        setDragIdx(null);
        if (playIdx !== null && isMyTurn) {
          const card = hand[playIdx];
          if (card && isValidPlay(card, topCard)) playCard(card);
        }
      },
      [computeCardIdxFromX, hand, isMyTurn, topCard, playCard]
    );

    const onMobilePointerCancel = useCallback(() => setDragIdx(null), []);

    // Cleanup on unmount
    useEffect(
      () => () => {
        if (clearAnimTimerRef.current !== null) window.clearTimeout(clearAnimTimerRef.current);
      },
      []
    );

    // ── Layout math ───────────────────────────────────────────────────────
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

                    const staggerOrder = newCardAnimData.get(idx) ?? -1;
                    const dealStyle: React.CSSProperties = staggerOrder >= 0
                      ? { animation: 'dealCard 300ms ease-out both', animationDelay: `${staggerOrder * 260}ms` }
                      : {};

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
                          style={{ width: cardSize.w, height: cardSize.h, ...dealStyle }}
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

        {/* Mobile — fan layout, all cards visible, no scroll */}
        <div
          ref={mobileRef}
          className="sm:hidden relative w-full select-none"
          style={{
            height: MOBILE_CARD_H + MOBILE_LIFT_PX + 8,
            touchAction: 'none',
            paddingBottom: 'max(env(safe-area-inset-bottom), 4px)',
          }}
          onPointerDown={onMobilePointerDown}
          onPointerMove={onMobilePointerMove}
          onPointerUp={onMobilePointerUp}
          onPointerCancel={onMobilePointerCancel}
          role="listbox"
          aria-label="Your hand"
        >
          {hand.map((card, idx) => {
            const canPlay = isMyTurn && isValidPlay(card, topCard);
            const isLifted = dragIdx === idx;

            const staggerOrder = newCardAnimData.get(idx) ?? -1;
            const dealStyle: React.CSSProperties = staggerOrder >= 0
              ? { animation: 'dealCard 300ms ease-out both', animationDelay: `${staggerOrder * 260}ms` }
              : {};

            return (
              <div
                key={`m-${card}-${idx}`}
                className="absolute bottom-0 transition-transform duration-100 ease-out"
                style={{
                  left: mobilePositions[idx] ?? 0,
                  zIndex: 100 + idx + (isLifted ? 1000 : 0),
                  transform: isLifted ? `translateY(-${MOBILE_LIFT_PX}px)` : 'none',
                }}
              >
                <CardView
                  card={card}
                  disabled={false}
                  selected={isLifted}
                  className={[
                    'shadow-md pointer-events-none',
                    isLifted && canPlay
                      ? 'ring-2 ring-yellow-400 ring-offset-1 ring-offset-emerald-900'
                      : isLifted
                      ? 'ring-2 ring-white/50 ring-offset-1'
                      : canPlay
                      ? 'ring-1 ring-yellow-400/40'
                      : 'opacity-90',
                  ].join(' ')}
                  style={{ width: MOBILE_CARD_W, height: MOBILE_CARD_H, ...dealStyle }}
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