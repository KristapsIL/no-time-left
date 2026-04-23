import React, { useEffect } from 'react';
import { Deck } from '@/components/Board/Deck';
import { TopCard } from '@/components/Board/TopCard';
import { CardView } from '@/components/Board/CardView';
import { CardBack } from '@/components/Board/CardBack';
import { TurnInfo } from '@/components/Board/TurnInfo';
import type { FlyingCard } from '@/hooks/useGameEngine';

// Sākotne transformācija pa kuri kartes nāk (likšanas animācija)
function startTransform(from: FlyingCard['from']): string {
  switch (from) {
    case 'bottom': return 'translate(-50%, 250%) scale(1.05) rotate(-6deg)';
    case 'top':    return 'translate(-50%, -250%) scale(1.05) rotate(8deg)';
    case 'left':   return 'translate(-350%, 10%) scale(1.05) rotate(-14deg)';
    case 'right':  return 'translate(270%, 10%) scale(1.05) rotate(14deg)';
  }
}

type Props = {
  topCard: string | null;
  isPlacementLocked: boolean;
  placingCard: string | null;
  flyingCard: FlyingCard | null;
  isFlying: boolean;
  isMyTurn: boolean;
  turnExpired: boolean;
  turnTimeLeft: number;
  isBotActionPending: boolean;
  currentTurn: number | null;
  userId: number;
  onPickup: () => void;
  pickingUpCount: number;
  peerPickupAnims: Array<{ id: number; direction: FlyingCard['from']; count: number }>;
  currentTurnName?: string | null;
};

// Tabulas centrs — kava, galda kārts, lidojošā kārts un gājiena animācija
export const CenterTable: React.FC<Props> = ({
  topCard,
  isPlacementLocked,
  placingCard,
  flyingCard,
  isFlying,
  isMyTurn,
  turnExpired,
  turnTimeLeft,
  isBotActionPending,
  currentTurn,
  userId,
  onPickup,
  pickingUpCount,
  peerPickupAnims,
  currentTurnName,
}) => {
  // Pievienojam animācijas keyframes, tikai vienu reizi
  useEffect(() => {
    const id = 'card-anim-kf';
    if (!document.getElementById(id)) {
      const s = document.createElement('style');
      s.id = id;
      s.textContent = `
        @keyframes pickupBottom{0%{transform:translate(calc(-50% - 48px),-50%) scale(1);opacity:.95}60%{opacity:.6}100%{transform:translate(-50%,280%) scale(.7);opacity:0}}
        @keyframes pickupTop   {0%{transform:translate(calc(-50% - 48px),-50%) scale(1);opacity:.95}60%{opacity:.6}100%{transform:translate(-50%,-280%) scale(.7);opacity:0}}
        @keyframes pickupLeft  {0%{transform:translate(calc(-50% - 48px),-50%) scale(1);opacity:.95}60%{opacity:.6}100%{transform:translate(-360%,-50%) scale(.7);opacity:0}}
        @keyframes pickupRight {0%{transform:translate(calc(-50% - 48px),-50%) scale(1);opacity:.95}60%{opacity:.6}100%{transform:translate(280%,-50%) scale(.7);opacity:0}}
        @keyframes drawnCardIn {from{opacity:0;transform:translateY(24px) scale(.8)} to{opacity:1;transform:translateY(0) scale(1)}}
      `;
      document.head.appendChild(s);
    }
  }, []);

  const deckClickable =
    isMyTurn &&
    !turnExpired &&
    turnTimeLeft > 0 &&
    !isPlacementLocked &&
    !isBotActionPending &&
    pickingUpCount === 0;

  return (
    <div className="flex flex-col items-center gap-4 md:gap-6">
      <div className="relative flex gap-8 md:gap-12 items-center justify-center flex-wrap">

        {/* ── My pickup: card backs fly from deck toward my hand ── */}
        {pickingUpCount > 0 && Array.from({ length: pickingUpCount }, (_, i) => (
          <div
            key={`self-${i}`}
            className="pointer-events-none absolute z-20"
            style={{ animation: `pickupBottom 480ms ease-in-out both`, animationDelay: `${i * 150}ms` }}
          >
            <CardBack width={40} height={56} fillColor="#1e3a5f" bandColor="#0ea5e9" rimColor="rgba(0,0,0,0.45)" label="" />
          </div>
        ))}

        {/* ── Peer pickups: card backs fly toward each opponent's seat ── */}
        {peerPickupAnims.map(({ id, direction, count }) =>
          Array.from({ length: count }, (_, i) => (
            <div
              key={`peer-${id}-${i}`}
              className="pointer-events-none absolute z-20"
              style={{
                animation: `pickup${direction.charAt(0).toUpperCase() + direction.slice(1)} 480ms ease-in-out both`,
                animationDelay: `${i * 150}ms`,
              }}
            >
              <CardBack width={38} height={54} fillColor="#3a1e5f" bandColor="#a855f7" rimColor="rgba(0,0,0,0.45)" label="" />
            </div>
          ))
        )}

        {/* ── Placement animation: card flying from origin to top-card pile ── */}
        {placingCard && flyingCard && isPlacementLocked && (
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 z-30 transition-transform duration-700 ease-out"
            style={{
              transform: isFlying
                ? 'translate(-15%, -85%) scale(0.88) rotate(0deg)'
                : startTransform(flyingCard.from),
            }}
          >
            <CardView card={placingCard} disabled className="w-10 h-14 sm:w-12 sm:h-16 shadow-2xl" />
          </div>
        )}

        {/* ── Drawn card rendered in Board.tsx above the hand area ── */}

        <Deck isMyTurn={deckClickable} pickupCard={onPickup} />
        <TopCard topCard={topCard} isPlacing={isPlacementLocked} />
      </div>

      <TurnInfo
        currentTurn={currentTurn}
        currentTurnName={currentTurnName}
        userId={userId}
        turnTimeLeft={turnTimeLeft}
        isPlacementLocked={isPlacementLocked}
        placingCard={placingCard}
        isBotActionPending={isBotActionPending}
      />
    </div>
  );
};
