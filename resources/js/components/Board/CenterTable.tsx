import React from 'react';
import { Deck } from '@/components/Board/Deck';
import { TopCard } from '@/components/Board/TopCard';
import { CardView } from '@/components/Board/CardView';
import { TurnInfo } from '@/components/Board/TurnInfo';

type FlyingCard = {
  card: string;
  from: 'player' | 'bot' | 'peer';
};

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
};

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
}) => (
  <div className="flex flex-col items-center gap-4 md:gap-6">
    <div className="relative flex gap-8 md:gap-12 items-center justify-center flex-wrap">
      {placingCard && flyingCard && isPlacementLocked && (
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 z-30 transition-transform duration-700 ease-out"
          style={{
            transform: isFlying
              ? 'translate(-15%, -85%) scale(0.88) rotate(0deg)'
              : flyingCard.from === 'player'
                ? 'translate(-130%, 130%) scale(1) rotate(-10deg)'
                : flyingCard.from === 'bot'
                  ? 'translate(-100%, -190%) scale(1) rotate(8deg)'
                  : 'translate(120%, 10%) scale(1) rotate(7deg)',
          }}
        >
          <CardView card={placingCard} disabled className="w-10 h-14 sm:w-12 sm:h-16 shadow-2xl" />
        </div>
      )}
      <Deck
        isMyTurn={isMyTurn && !turnExpired && turnTimeLeft > 0 && !isPlacementLocked && !isBotActionPending}
        pickupCard={onPickup}
      />
      <TopCard topCard={topCard} isPlacing={isPlacementLocked} />
    </div>

    <TurnInfo
      currentTurn={currentTurn}
      userId={userId}
      turnTimeLeft={turnTimeLeft}
      isPlacementLocked={isPlacementLocked}
      placingCard={placingCard}
      isBotActionPending={isBotActionPending}
    />
  </div>
);
