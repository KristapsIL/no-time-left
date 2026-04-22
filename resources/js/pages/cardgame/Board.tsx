import React, { memo } from 'react';
import { Head, usePage } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import RoomChat from '@/components/RoomChat';
import { PlayerHand } from '@/components/Board/PlayerHand';
import { GameControls } from '@/components/Board/GameControls';
import { CardView } from '@/components/Board/CardView';
import { CardBack } from '@/components/Board/CardBack';
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

/** Compact card-fan + name badge for all opponents on mobile */
const MobileOpponentFan = memo(function MobileOpponentFan({
  player,
  count,
  isTurn,
}: {
  player: PlayerLite;
  count: number;
  isTurn: boolean;
}) {
  const MAX_SHOW = 4;
  const CW = 40, CH = 57, STEP = 7;
  const show = Math.max(1, Math.min(count, MAX_SHOW));
  return (
    <div
      className={[
        'flex flex-col items-center gap-1 px-2 pt-2 pb-1.5 rounded-xl transition',
        isTurn ? 'bg-yellow-400/15 ring-1 ring-yellow-400/60' : 'bg-black/20',
      ].join(' ')}
    >
      {/* Fanned card backs */}
      <div className="relative" style={{ width: CW + (show - 1) * STEP, height: CH + (show - 1) * STEP }}>
        {Array.from({ length: show }, (_, i) => (
          <div key={i} className="absolute" style={{ top: i * STEP, left: i * STEP, zIndex: i }}>
            <CardBack width={CW} height={CH} fillColor="#1f2937" bandColor="#0ea5e9" rimColor="rgba(0,0,0,0.35)" label="" />
          </div>
        ))}
      </div>
      <span className={`text-[10px] font-medium truncate max-w-[72px] ${isTurn ? 'text-yellow-300' : 'text-white/70'}`}>
        {player.name ?? `P${player.id}`}
      </span>
      <span className={`text-[10px] font-bold tabular-nums ${isTurn ? 'text-yellow-400' : 'text-white/40'}`}>
        {count}
      </span>
    </div>
  );
});

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

  // ── Collect all opponents for mobile strip ──────────────────────────────
  const allMobileOpponents: Array<{ seat: PlayerLite; count: number }> = [
    ...(seats.top   ? [{ seat: seats.top,   count: topCount   }] : []),
    ...(seats.left  ? [{ seat: seats.left,  count: leftCount  }] : []),
    ...(seats.right ? [{ seat: seats.right, count: rightCount }] : []),
    ...(seats.overflow ?? []).map((s) => ({ seat: s, count: game.handCounts[String(s.id)] ?? 0 })),
  ];

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
          isChatOpen={isChatOpen}
          toggleChat={() => setIsChatOpen((o) => !o)}
          roomId={room.id}
          roomRules={room.rules}
        />
      )}

      {/* ── Game board ────────────────────────────────────────────────── */}
      <div
        className="
          min-h-[100dvh] w-full grid relative
          grid-cols-1 grid-rows-[auto_1fr_auto]
          md:grid-rows-[auto_1fr_auto]
          md:grid-cols-[130px_minmax(0,1fr)_130px]
          lg:grid-cols-[150px_minmax(0,1fr)_150px]
          gap-2 md:gap-4 p-2 md:p-4
          bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white overflow-hidden
          pt-[max(env(safe-area-inset-top),8px)] pb-[max(env(safe-area-inset-bottom),8px)]
        "
      >
        {/* ── Row 1: Opponents ────────────────────────────────────────── */}
        {/* Mobile: all opponents as compact card fans in one strip */}
        <div className="md:hidden row-start-1 col-start-1 flex items-end justify-center gap-3 px-2 pt-1 flex-wrap min-h-[110px]">
          {allMobileOpponents.length > 0 ? (
            allMobileOpponents.map(({ seat, count }) => (
              <MobileOpponentFan
                key={seat.id}
                player={seat}
                count={count}
                isTurn={isSeatTurn(seat.id)}
              />
            ))
          ) : (
            <div className="opacity-60 text-sm self-center">Waiting for players…</div>
          )}
        </div>

        {/* Desktop: top opponent fan */}
        <div className="hidden md:flex row-start-1 col-start-2 min-w-0 items-center justify-center [container-type:inline-size] min-h-[150px]">
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

        {/* ── Desktop Left ─────────────────────────────────────────────── */}
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

        {/* ── Center table ─────────────────────────────────────────────── */}
        <div className="row-start-2 col-start-1 md:col-start-2 min-w-0 flex items-center justify-center">
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

        {/* ── Desktop Right ────────────────────────────────────────────── */}
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

        {/* ── Bottom: hand + controls ───────────────────────────────────── */}
        <div className="row-start-3 col-span-1 md:col-span-3 flex flex-col items-center gap-2 pb-1 md:pb-0">
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

        {/* ── Game over modal — scoped to board content area ────────────── */}
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
      </div>

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
