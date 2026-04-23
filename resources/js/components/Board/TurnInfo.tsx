import React from 'react';

type Props = {
  currentTurn: number | null;
  currentTurnName?: string | null;
  userId: number;
  turnTimeLeft: number;
  isPlacementLocked: boolean;
  placingCard: string | null;
  isBotActionPending: boolean;
};

export const TurnInfo: React.FC<Props> = ({
  currentTurn,
  currentTurnName,
  userId,
  turnTimeLeft,
  isPlacementLocked,
  placingCard,
  isBotActionPending,
}) => (
  <>
    {currentTurn != null && (
      <div className="text-xs opacity-80 space-y-1 text-center">
        <div>
          Turn:{' '}
          <span className="font-semibold">
            {currentTurn === userId ? 'You' : (currentTurnName ?? `Player ${currentTurn}`)}
          </span>
        </div>
        <div className="text-sm text-indigo-600 dark:text-indigo-300">
          {currentTurn === userId ? 'Your turn' : `${currentTurnName ?? `Player ${currentTurn}`}'s turn`}: {turnTimeLeft}s
        </div>
      </div>
    )}

    <div className="min-h-[42px] flex flex-col items-center justify-center gap-1">
      {isPlacementLocked && placingCard && (
        <div className="text-[11px] rounded-full bg-amber-500/20 border border-amber-400/40 px-3 py-1 text-amber-100">
          Placing {placingCard.replace('-', ' ')}...
        </div>
      )}
      {isBotActionPending && (
        <div className="text-[11px] rounded-full bg-cyan-500/20 border border-cyan-400/40 px-3 py-1 text-cyan-100">
          Bot is thinking...
        </div>
      )}
    </div>
  </>
);
