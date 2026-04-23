import React, { memo, useMemo } from 'react';
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
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { useGameEngine, type PlayerLite } from '@/hooks/useGameEngine';
import { useToast } from '@/hooks/useToast';

// ── Props ─────────────────────────────────────────────────────────────────────
type Player = { id: number; name?: string; role?: string; avatar_url?: string | null };

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
  pickupPenalty?: number;
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
  <div className="flex items-center gap-1.5">
    <PlayerAvatar id={player.id} name={player.name} size={20} avatarUrl={player.avatar_url} />
    <span className="opacity-90 truncate max-w-[70px]">{player.name ?? `Player ${player.id}`}</span>
    <span className="bg-black/40 rounded px-1 py-0.5">{count}</span>
    {overflow && overflow.length > 0 && (
      <span title={overflow.map((p) => p.name ?? p.id).join(', ')}>
        +{overflow.length}
      </span>
    )}
  </div>
);

/** Compact arc-fan + name badge for each opponent on mobile */
const MobileOpponentFan = memo(function MobileOpponentFan({
  player,
  count,
  isTurn,
}: {
  player: PlayerLite;
  count: number;
  isTurn: boolean;
}) {
  const MAX_SHOW = 5;
  const CW = 36, CH = 52, ARC_R = 44;
  const show = Math.max(1, Math.min(count, MAX_SHOW));
  const totalDeg = Math.min(50, (show - 1) * 12);
  const startDeg = -totalDeg / 2;
  const step = show > 1 ? totalDeg / (show - 1) : 0;

  // Container wide enough to hold the fanned cards without clipping
  const halfSpread = Math.round((CH + ARC_R) * Math.sin((totalDeg / 2) * (Math.PI / 180))) + 2;
  const containerW = CW + halfSpread * 2 + 4;
  const containerH = CH + 8;

  return (
    <div
      className={[
        'flex flex-col items-center gap-0.5 px-2 pt-1.5 pb-1.5 rounded-xl transition select-none',
        isTurn
          ? 'bg-yellow-400/20 ring-2 ring-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.35)]'
          : 'bg-black/20',
      ].join(' ')}
    >
      {/* Name ABOVE fan */}
      <span
        className={`text-[10px] font-semibold truncate max-w-[80px] leading-none ${
          isTurn ? 'text-yellow-300' : 'text-white/70'
        }`}
      >
        {player.name ?? `P${player.id}`}
      </span>

      {/* Arc fan */}
      <div className="relative" style={{ width: containerW, height: containerH }}>
        {Array.from({ length: show }, (_, i) => {
          const angle = startDeg + i * step;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: containerW / 2 - CW / 2,
                top: 0,
                zIndex: i,
                transform: `rotate(${angle}deg)`,
                transformOrigin: `${CW / 2}px ${CH + ARC_R}px`,
              }}
            >
              <CardBack
                width={CW}
                height={CH}
                fillColor="#1e3a5f"
                bandColor="#0ea5e9"
                rimColor="rgba(0,0,0,0.45)"
                label=""
              />
            </div>
          );
        })}
      </div>

      {/* Card count below */}
      <span
        className={`text-[10px] font-bold tabular-nums leading-none ${
          isTurn ? 'text-yellow-400' : 'text-white/40'
        }`}
      >
        {count}
      </span>
    </div>
  );
});

// ── Board ─────────────────────────────────────────────────────────────────────
export default function Board() {
  const { props } = usePage<Props>();
  const { room, deck, usedCards, handCounts, myHand, gameStatus, currentTurn, winnerId, userId, creatorId, pickupPenalty } = props;
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
    isPickingUp: _isPickingUp,
    pickingUpCount,
    peerPickupAnims,
    drawnCards,
    showDrawnPlayOption,
    keepDrawnCard,
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
    initialPickupPenalty: pickupPenalty ?? 0,
    toast,
  });

  // ── Collect all opponents for mobile strip (in turn order: left → top → right) ──
  const currentTurnName = useMemo(() => {
    if (game.currentTurn == null) return null;
    if (game.currentTurn === userId) return 'You';
    const p = connectedPlayers.find((cp) => cp.id === game.currentTurn);
    return p?.name ?? `Player ${game.currentTurn}`;
  }, [game.currentTurn, userId, connectedPlayers]);

  // ── Collect all opponents for mobile strip (in turn order: left → top → right) ──
  const allMobileOpponents: Array<{ seat: PlayerLite; count: number }> = [
    ...(seats.left  ? [{ seat: seats.left,  count: leftCount  }] : []),
    ...(seats.top   ? [{ seat: seats.top,   count: topCount   }] : []),
    ...(seats.right ? [{ seat: seats.right, count: rightCount }] : []),
    ...(seats.overflow ?? []).map((s) => ({ seat: s, count: game.handCounts[String(s.id)] ?? 0 })),
  ];

  return (
    <AppLayout>
      <Head title="Game" />

      {/* ── Game board ────────────────────────────────────────────────── */}
      {/* isolate creates its own stacking context so hand z-indexes can't bleed
           above the sidebar Sheet (z-50) which lives outside this div */}
      <div
        className="
          flex-1 min-h-0 w-full grid relative isolate
          grid-cols-1 grid-rows-[auto_1fr_auto]
          md:grid-rows-[auto_1fr_auto]
          md:grid-cols-[130px_minmax(0,1fr)_130px]
          lg:grid-cols-[150px_minmax(0,1fr)_150px]
          gap-1.5 md:gap-3 p-1.5 md:p-3
          bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white overflow-hidden
          pt-[max(env(safe-area-inset-top),8px)] pb-[max(env(safe-area-inset-bottom),8px)]
        "
      >
        {/* ── Waiting lobby: absolute within content area so sidebar stays usable ── */}
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
        {/* ── Row 1: Opponents ────────────────────────────────────────── */}
        {/* Mobile: all opponents as compact arc fans in one strip (turn order) */}
        <div className="md:hidden row-start-1 col-start-1 flex items-end justify-center gap-1.5 px-2 pt-1 flex-wrap min-h-[92px]">
          {allMobileOpponents.length > 0 ? (
            allMobileOpponents.map(({ seat, count }, idx) => (
              <React.Fragment key={seat.id}>
                {idx > 0 && (
                  <span className="text-white/25 text-[10px] self-center pb-3">›</span>
                )}
                <MobileOpponentFan
                  player={seat}
                  count={count}
                  isTurn={isSeatTurn(seat.id)}
                />
              </React.Fragment>
            ))
          ) : (
            <div className="opacity-60 text-sm self-center">Waiting for players…</div>
          )}
        </div>

        {/* Desktop: top opponent fan */}
        <div className="hidden md:flex row-start-1 col-start-2 min-w-0 items-center justify-center [container-type:inline-size] min-h-[120px]">
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
        <div className="hidden md:flex row-start-2 col-start-1 min-w-0 items-start justify-center overflow-visible">
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
            pickingUpCount={pickingUpCount}
            peerPickupAnims={peerPickupAnims}
            currentTurnName={currentTurnName}
          />
        </div>

        {/* ── Desktop Right ────────────────────────────────────────────── */}
        <div className="hidden md:flex row-start-2 col-start-3 min-w-0 items-start justify-center overflow-visible">
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
        <div className="row-start-3 col-span-1 md:col-span-3 flex flex-col items-center gap-2 md:gap-1.5 pb-1.5 md:pb-0">
          <div className="relative w-full flex flex-col items-center">
            {/* Pickup penalty badge */}
            {game.pickupPenalty > 0 && (
              <div
                className={[
                  'mb-1 px-3 py-1 rounded-lg text-sm font-bold border',
                  isMyTurn
                    ? 'bg-red-500/25 border-red-500/60 text-red-300 animate-pulse'
                    : 'bg-red-500/10 border-red-500/30 text-red-400/80',
                ].join(' ')}
              >
                {isMyTurn
                  ? `⚠ Pick up +${game.pickupPenalty} cards!`
                  : `⚠ Pending +${game.pickupPenalty}`}
              </div>
            )}
            {/* Drawn card: absolute overlay above the hand (does not affect layout) */}
            {showDrawnPlayOption && drawnCards.length > 0 && (
              <div
                className="absolute z-50 pointer-events-none"
                style={{
                  left: '50%',
                  marginLeft: 0,
                  bottom: 'calc(100% + 8px)',
                  width: 110,
                }}
              >
                <div className="flex flex-col items-center gap-1 pointer-events-auto" style={{ width: 110, animation: 'drawnCardIn 380ms cubic-bezier(0.34,1.56,0.64,1) both' }}>
                  <CardView
                    card={drawnCards[0]}
                    style={{ width: 110, height: 160 }}
                    className="shadow-2xl ring-2 ring-cyan-300"
                    title="Play drawn card"
                    onClick={(e) => {
                      e.stopPropagation();
                      const card = drawnCards[0];
                      setShowDrawnPlayOption(false);
                      setDrawnCards([]);
                      if (card) playCard(card);
                    }}
                  />
                  <p className="text-[11px] text-cyan-200">Tap to play • {drawDecisionTimeLeft}s</p>
                </div>
              </div>
            )}
            <PlayerHand
              hand={
                showDrawnPlayOption && drawnCards.length > 0
                  ? (() => {
                      // Remove exactly one copy of the drawn card from the display hand
                      // so it appears to still be "in the other hand" until decided
                      const idx = game.hand.indexOf(drawnCards[0]);
                      if (idx === -1) return game.hand;
                      return [...game.hand.slice(0, idx), ...game.hand.slice(idx + 1)];
                    })()
                  : game.hand
              }
              topCard={game.topCard}
              isMyTurn={isMyTurn}
              playCard={onPlay}
              minSliver={6}
              maxStepFrac={0.7}
              pickupPenalty={game.pickupPenalty}
              stackingActive={Array.isArray(room.rules.rules) && room.rules.rules.includes('stacking')}
              plusTwoActive={Array.isArray(room.rules.rules) && room.rules.rules.includes('plus_two')}
            />
          </div>

        </div>

        <div className="absolute right-2 md:right-3 bottom-2 md:bottom-3 z-40">
          {game.status !== 'waiting' && (
            <GameControls
              isChatOpen={isChatOpen}
              toggleChat={() => setIsChatOpen((o) => !o)}
              leaveGame={leaveGame}
            />
          )}
        </div>

        <RoomChat roomId={room.id} isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />

        {/* ── Dismiss drawn-card decision by tapping outside ─────────────── */}
        {/* Must be INSIDE the isolate div (z-30 here < drawn card z-40 = button wins clicks) */}
        {showDrawnPlayOption && drawnCards.length > 0 && (
          <div
            className="absolute inset-0 z-30"
            onClick={() => {
              // Keep the drawn card in hand and close decision UI; turn is not passed here.
              keepDrawnCard();
            }}
          />
        )}

        {/* ── Game over modal — scoped to board content area ────────────── */}
        {game.status === 'finished' && (
          <GameOverModal
            winnerId={game.winnerId}
            userId={userId}
            connectedPlayers={connectedPlayers}
            onPlayAgain={playAgain}
            onLeave={leaveGame}
          />
        )}
      </div>
    </AppLayout>
  );
}
