import React from 'react';
import { Head, usePage } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import RoomChat from '@/components/RoomChat';
import { PlayerHand } from '@/components/Board/PlayerHand';
import { GameControls } from '@/components/Board/GameControls';
import { CardView } from '@/components/Board/CardView';
import { CenterTable } from '@/components/Board/CenterTable';
import { GameOverModal } from '@/components/Board/GameOverModal';
import { WaitingLobby } from '@/components/Board/WaitingLobby';
import { OpponentHandRail } from '@/components/Board/OpponentHandRail';
import { useGameEngine, type PlayerLite } from '@/hooks/useGameEngine';
import { useToast } from '@/hooks/useToast';

// ── Props ─────────────────────────────────────────────────────────────────────
type Player = { id: number; name?: string; role?: string };

type Room = {
  id: number;
  code: string;
  created_by?: number;
  rules: {
    public: boolean;
    max_players: number;
    turn_timeout_seconds?: number;
    bot_fill_count?: number;
    rules: string[];
  };
  players?: Player[];
};

type Props = {
  room: Room;
  deck: string[];
  usedCards?: string[];
  handCounts?: Record<string, number>;
  myHand?: string[];
  gameStatus?: 'waiting' | 'in_progress' | 'finished';
  currentTurn?: number | null;
  winnerId?: number | null;
  userId: number;
  creatorId?: number;
};

// ── Small helpers ─────────────────────────────────────────────────────────────
const OpponentLabel = ({
  player,
  count,
  overflow,
}: {
  player: PlayerLite;
  count: number;
  overflow?: PlayerLite[];
}) => (
  <div className="flex items-center gap-2">
    <span className="opacity-90">{player.name ?? `Player ${player.id}`}</span>
    <span className="bg-black/40 rounded px-1.5 py-0.5">{count}</span>
    {overflow && overflow.length > 0 && (
      <span title={overflow.map((p) => p.name ?? p.id).join(', ')}>
        +{overflow.length}
      </span>
    )}
  </div>
);

// ── Board ─────────────────────────────────────────────────────────────────────
export default function Board() {
  const { props } = usePage<Props>();
  const { room, deck, usedCards, handCounts, myHand, gameStatus, currentTurn, winnerId, userId, creatorId } = props;
  const toast = useToast();
  const isCreator = userId === (creatorId ?? room.created_by ?? -1);

  const {
    game,
    isMyTurn,
    seats,
    isSeatTurn,
    leftCount,
    topCount,
    rightCount,
    connectedPlayers,
    turnTimeLeft,
    drawDecisionTimeLeft,
    turnExpiredRef,
    flyingCard,
    isFlying,
    isPlacementLocked,
    placingCard,
    isBotActionPending,
    drawnCards,
    showDrawnPlayOption,
    setShowDrawnPlayOption,
    setDrawnCards,
    isChatOpen,
    setIsChatOpen,
    isStartingGame,
    onPlay,
    onPickup,
    playCard,
    passTurn,
    startGame,
    leaveGame,
    playAgain,
  } = useGameEngine({
    room,
    userId,
    initialHand: myHand ?? [],
    initialDeckCount: deck?.length ?? 0,
    initialUsedCards: usedCards ?? [],
    initialHandCounts: handCounts ?? {},
    initialGameStatus: gameStatus ?? 'waiting',
    initialCurrentTurn: currentTurn ?? null,
    initialWinnerId: winnerId ?? null,
    toast,
  });

  return (
    <AppLayout>
      <Head title="Game" />

      {/* ── Waiting lobby overlay ──────────────────────────────────────── */}
      {game.status === 'waiting' && (
        <WaitingLobby
          players={connectedPlayers}
          userId={userId}
          isCreator={isCreator}
          isStartingGame={isStartingGame}
          roomCode={room.code}
          onStart={startGame}
          onLeave={leaveGame}
        />
      )}

      {/* ── Game board grid ────────────────────────────────────────────── */}
      <div
        className="
          min-h-[100dvh] w-full grid
          grid-cols-1 grid-rows-[auto_auto_1fr_auto]
          md:grid-rows-[auto_1fr_auto]
          md:grid-cols-[96px_minmax(0,1fr)_96px]
          lg:grid-cols-[112px_minmax(0,1fr)_112px]
          gap-3 md:gap-4 p-3 md:p-4
          bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white relative overflow-hidden
          pt-[max(env(safe-area-inset-top),8px)] pb-[max(env(safe-area-inset-bottom),12px)]
        "
      >
        {/* TOP opponent */}
        <div className="row-start-1 col-start-1 md:col-start-2 min-w-0 min-h-[150px] flex items-center justify-center [container-type:inline-size]">
          {seats.top ? (
            <OpponentHandRail
              side="top"
              handCount={topCount}
              isTurn={isSeatTurn(seats.top.id)}
              label={<OpponentLabel player={seats.top} count={topCount} overflow={seats.overflow} />}
            />
          ) : (
            <div className="opacity-60 text-sm">Waiting for players…</div>
          )}
        </div>

        {/* MOBILE: compact opponent badges */}
        <div className="md:hidden row-start-2 col-start-1 flex items-center gap-2 overflow-x-auto scrollbar-none px-1 py-1">
          {([
            seats.left ? { seat: seats.left, count: leftCount } : null,
            seats.right ? { seat: seats.right, count: rightCount } : null,
          ] as Array<{ seat: PlayerLite; count: number } | null>)
            .filter((item): item is { seat: PlayerLite; count: number } => item !== null)
            .map((item) => (
              <div
                key={item.seat.id}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium shrink-0 ${
                  isSeatTurn(item.seat.id) ? 'bg-yellow-400 text-black' : 'bg-black/40 text-white'
                }`}
              >
                <span>{item.seat.name ?? `Player ${item.seat.id}`}</span>
                <span className="bg-white/20 rounded-full px-1.5 py-0.5">{item.count}</span>
              </div>
            ))}
        </div>

        {/* DESKTOP LEFT */}
        <div className="hidden md:flex row-start-2 col-start-1 min-w-0 items-center justify-center">
          {seats.left ? (
            <OpponentHandRail
              side="left"
              handCount={leftCount}
              isTurn={isSeatTurn(seats.left.id)}
              label={<OpponentLabel player={seats.left} count={leftCount} />}
            />
          ) : (
            <div />
          )}
        </div>

        {/* CENTER table */}
        <div className="row-start-3 md:row-start-2 col-start-1 md:col-start-2 min-w-0 flex items-center justify-center">
          <CenterTable
            topCard={game.topCard}
            isPlacementLocked={isPlacementLocked}
            placingCard={placingCard}
            flyingCard={flyingCard}
            isFlying={isFlying}
            isMyTurn={isMyTurn}
            turnExpired={turnExpiredRef.current}
            turnTimeLeft={turnTimeLeft}
            isBotActionPending={isBotActionPending}
            currentTurn={game.currentTurn}
            userId={userId}
            onPickup={onPickup}
          />
        </div>

        {/* DESKTOP RIGHT */}
        <div className="hidden md:flex row-start-2 col-start-3 min-w-0 items-center justify-center">
          {seats.right ? (
            <OpponentHandRail
              side="right"
              handCount={rightCount}
              isTurn={isSeatTurn(seats.right.id)}
              label={<OpponentLabel player={seats.right} count={rightCount} />}
            />
          ) : (
            <div />
          )}
        </div>

        {/* BOTTOM: hand + controls */}
        <div className="row-start-4 md:row-start-3 col-span-1 md:col-span-3 flex flex-col items-center gap-3 pb-2 md:pb-0">
          <div className="relative w-full flex flex-col items-center">
            {showDrawnPlayOption && drawnCards.length > 0 && (
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const card = drawnCards[0];
                    setShowDrawnPlayOption(false);
                    setDrawnCards([]);
                    if (card) playCard(card);
                  }}
                  className="rounded-lg transition hover:-translate-y-1"
                  title="Play drawn card"
                >
                  <CardView card={drawnCards[0]} className="w-[110px] h-[160px] shadow-2xl ring-2 ring-cyan-300" />
                </button>
                <p className="text-[11px] text-cyan-200">Tap to play • {drawDecisionTimeLeft}s</p>
              </div>
            )}
            <PlayerHand
              hand={game.hand}
              topCard={game.topCard}
              isMyTurn={isMyTurn}
              playCard={onPlay}
              minSliver={6}
              maxStepFrac={0.7}
            />
          </div>

          <GameControls
            isChatOpen={isChatOpen}
            toggleChat={() => setIsChatOpen((o) => !o)}
            leaveGame={leaveGame}
          />
        </div>

        <RoomChat roomId={room.id} isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
      </div>

      {/* ── Game over modal ────────────────────────────────────────────── */}
      {game.status === 'finished' && (
        <GameOverModal
          winnerId={game.winnerId}
          userId={userId}
          isCreator={isCreator}
          roomId={room.id}
          roomRules={room.rules}
          connectedPlayers={connectedPlayers}
          onPlayAgain={playAgain}
          onLeave={leaveGame}
        />
      )}

      {/* Dismiss drawn-card decision by tapping outside */}
      {showDrawnPlayOption && drawnCards.length > 0 && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => {
            setShowDrawnPlayOption(false);
            setDrawnCards([]);
            if (game.currentTurn === userId) passTurn();
          }}
        />
      )}
    </AppLayout>
  );
}
