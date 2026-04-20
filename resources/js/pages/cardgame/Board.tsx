// Board.tsx
import React, {
  useReducer,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
  startTransition,
} from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import RoomChat from '@/components/RoomChat';
import { PlayerHand } from '@/components/Board/PlayerHand';
import { Deck } from '@/components/Board/Deck';
import { TopCard } from '@/components/Board/TopCard';
import { GameControls } from '@/components/Board/GameControls';

import echo from '@/lib/echo';
import { isValidPlay, uniqById } from '@/utils/gameLogic';
import { playCardApi, pickupCardApi, passTurnApi, resyncStateApi, resetGameApi} from '@/utils/api';
import { getTypedEcho } from '@/types/echo';
import { useToast } from '@/hooks/useToast';

import { OpponentHandRail } from '@/components/Board/OpponentHandRail';
import { getSeats } from '@/utils/getSeats';

type PlayerLite = { id: string; name?: string };

// ---------- Types ----------
type Player = { id: number; name?: string };

type Room = {
  id: number;
  code: string;
  rules: {
    public: boolean;
    max_players: number;
    turn_timeout_seconds?: number;
    rules: string[];
  };
  player_hands?: Record<string, string[]>;
  used_cards?: string[];
  game_status?: 'waiting' | 'in_progress' | 'finished';
  players?: Player[];
};

type Props = {
  room: Room;
  deck: string[];
  userId: number;
};

type GameStartedPayload = {
  turnPlayerId?: number;
  deckCount?: number;
  handCounts?: Record<string, number>;
  usedCards?: string[];
  turn_player_id?: number;
  deck_count?: number;
  hand_counts?: Record<string, number>;
  used_cards?: string[];
};

type CardPlayedPayload = {
  usedCards?: string[];
  handCounts?: Record<string, number>;
  deckCount?: number;
  turnPlayerId?: number;
  used_cards?: string[];
  hand_counts?: Record<string, number>;
  deck_count?: number;
  turn_player_id?: number;
};

type GameState = {
  hand: string[];
  deckCount: number;
  topCard: string | null;
  handCounts: Record<string, number>;
  currentTurn: number | null;
  status?: 'waiting' | 'in_progress' | 'finished';
  winnerId?: number | null;
};

type Action =
  | { type: 'SERVER_SYNC'; payload: Partial<GameState> }
  | { type: 'SET_TURN'; turn: number | null };

function gameReducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'SERVER_SYNC':
      return { ...state, ...action.payload };
    case 'SET_TURN':
      return { ...state, currentTurn: action.turn };
    default:
      return state;
  }
}

export default function Board() {
  const { props } = usePage<Props>();
  const { room, deck, userId } = props;
  const uid = String(userId);
  const toast = useToast();

  const [game, dispatch] = useReducer(gameReducer, {
    hand: room.player_hands?.[uid] ?? [],
    deckCount: deck?.length ?? 0,
    topCard: room.used_cards?.at(-1) ?? null,
    handCounts: {},
    currentTurn: null,
  });

  const turnTimeoutSeconds = room.rules.turn_timeout_seconds ?? 5;
  const [turnTimeLeft, setTurnTimeLeft] = useState(turnTimeoutSeconds);
  const turnExpiredRef = useRef(false);

  // Keep a ref to the latest game state for async handlers
  const gameRef = useRef(game);
  const turnJustStartedRef = useRef(false);
  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  useEffect(() => {
    setTurnTimeLeft(turnTimeoutSeconds);
    turnExpiredRef.current = false;
    turnJustStartedRef.current = true;
    const cleanup = window.setTimeout(() => {
      turnJustStartedRef.current = false;
    }, 0);

    return () => window.clearTimeout(cleanup);
  }, [game.currentTurn, turnTimeoutSeconds]);

  useEffect(() => {
    if (game.currentTurn == null || game.status !== 'in_progress') return;

    const timer = window.setInterval(() => {
      setTurnTimeLeft((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [game.currentTurn, game.status]);

  const [connectedPlayers, setConnectedPlayers] = useState<Player[]>(room.players ?? []);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isStartingGame, setIsStartingGame] = useState(false);
  const isMyTurn = useMemo(() => game.currentTurn === userId, [game.currentTurn, userId]);

  const passTurn = useCallback(async () => {
    try {
      const data = await passTurnApi(room.id);
      if (typeof data.current_turn === 'number') {
        dispatch({ type: 'SET_TURN', turn: data.current_turn });
      }
    } catch (error) {
      console.error('pass turn failed', error);
      toast.error('Unable to pass turn automatically.');
    }
  }, [room.id, toast]);

  // ----- Event handlers -----
  const onGameStarted = (raw: unknown) => {
    const data = raw as any;

    dispatch({
      type: 'SERVER_SYNC',
      payload: {
        deckCount: data.deck_count ?? 0,
        handCounts: data.hand_counts ?? {},
        topCard: (data.used_cards ?? []).at(-1) ?? gameRef.current.topCard,
        status: 'in_progress',
      },
    });
    dispatch({ type: 'SET_TURN', turn: data.turn_player_id ?? null });
    setIsStartingGame(false);
  };

  const onCardPlayed = (raw: unknown) => {
    const data = raw as any;
    const used = data.used_cards ?? [];

    const patch: Partial<GameState> = {};
    if (used.length) patch.topCard = used[used.length - 1];
    if (data.hand_counts) patch.handCounts = data.hand_counts;
    if (typeof data.deck_count === 'number') patch.deckCount = data.deck_count;

    if (Object.keys(patch).length) dispatch({ type: 'SERVER_SYNC', payload: patch });
    if (typeof data.turn_player_id === 'number') dispatch({ type: 'SET_TURN', turn: data.turn_player_id });
  };

  const onHandSynced = (raw: unknown) => {
    const d = raw as any;
    if (d.user_id !== userId) return;

    startTransition(() => {
      dispatch({
        type: 'SERVER_SYNC',
        payload: {
          hand: d.hand ?? gameRef.current.hand,
          handCounts: d.hand_counts ?? gameRef.current.handCounts,
          deckCount: d.deck_count ?? gameRef.current.deckCount,
          topCard: (d.used_cards ?? []).at(-1) ?? gameRef.current.topCard,
        },
      });
      if (typeof d.turn_player_id === 'number') dispatch({ type: 'SET_TURN', turn: d.turn_player_id });
    });
  }

  const onGameFinished = (raw: unknown) => {
    const d = raw as any;
    const winner = d.winner_id ?? null;

    dispatch({
      type: 'SERVER_SYNC',
      payload: {
        status: 'finished',
        winnerId: winner,
        handCounts: d.hand_counts ?? gameRef.current.handCounts,
      },
    });
    dispatch({ type: 'SET_TURN', turn: null });
  };

const onGameReset = () => {
  dispatch({
    type: 'SERVER_SYNC',
    payload: {
      status: 'waiting',
      winnerId: null,
      topCard: null,
      deckCount: 0,
      hand: [],
      handCounts: {},
      currentTurn: null,
    },
  });
};

  // ----- Echo subscribe -----
  useEffect(() => {
    const typedEcho = getTypedEcho(echo);
    if (!typedEcho) return;

    const channel = typedEcho.join(`room-${room.id}`);
    if (!channel) return;

    channel.here((members: any[]) => {
      const players: Player[] = (members ?? []).map((m) => ({
        id: m.id,
        name: m.name ?? `Player ${m.id}`,
      }));
      setConnectedPlayers(uniqById(players));
    });

    channel.joining((member: any) => {
      const player: Player = { id: member.id, name: member.name ?? `Player ${member.id}` };
      setConnectedPlayers((prev) => uniqById([...(prev ?? []), player]));
    });

    channel.leaving((member: any) => {
      setConnectedPlayers((prev) => (prev ?? []).filter((p) => p.id !== member.id));
    });

    channel.listen('.game-started', onGameStarted);
    channel.listen('.card-played', onCardPlayed);
    channel.listen('.hand-synced', onHandSynced);
    channel.listen('.game-finished', onGameFinished);
    channel.listen('.game-reset', onGameReset);
    return () => {
      try {
        channel.stopListening('.game-started');
        channel.stopListening('.card-played');
        channel.stopListening('.hand-synced');
        channel.stopListening('.game-finished');
        channel.stopListening('.game-reset');
        typedEcho.leave(`room-${room.id}`);
      } catch (err) {
        console.log(err);
      }
    };
  }, [room.id]);

  // ----- Initial resync (optional but handy) -----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await resyncStateApi(room.id);
        if (cancelled) return;
        dispatch({
          type: 'SERVER_SYNC',
          payload: {
            hand: data.hand ?? gameRef.current.hand,
            handCounts: data.hand_counts ?? gameRef.current.handCounts,
            deckCount: typeof data.deck_count === 'number' ? data.deck_count : gameRef.current.deckCount,
            topCard: (data.used_cards ?? []).at(-1) ?? gameRef.current.topCard,
            status: data.game_status ?? gameRef.current.status,
          },
        });
        dispatch({ type: 'SET_TURN', turn: data.current_turn ?? null });
      } catch (e) {
        console.error('resync failed', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [room.id]);

  // ----- Actions -----
  
  // Saglabā pēdējo spēles stāvokli gadījumam, ja servera pieprasījums neizdodas
  const lastSnapshotRef = useRef<GameState | null>(null);

  const playCard = useCallback(
    async (card: string) => {
       // Pārbauda, vai ir spēlētāja gājiens un vai kārts ir derīga
      if (!isMyTurn || !isValidPlay(card, gameRef.current.topCard)) return;
      // Saglabā pašreizējo spēles stāvokli, lai kļūmes gadījumā varētu atjaunot
      lastSnapshotRef.current = gameRef.current;

      const cur = gameRef.current;
      const idx = cur.hand.indexOf(card);

      // Noņem izvēlēto kārti no spēlētāja rokas
      const nextHand = idx >= 0 ? [...cur.hand.slice(0, idx), ...cur.hand.slice(idx + 1)] : cur.hand;
      // Saglabā iepriekšējo kāršu skaitu spēlētājam
      const myCountBefore = cur.handCounts[uid] ?? cur.hand.length;

      // Optimistiski atjauno spēles stāvokli lokāli (pirms servera apstiprinājuma)
      dispatch({
        type: 'SERVER_SYNC',
        payload: {
          hand: nextHand,
          topCard: card,
          handCounts: { ...cur.handCounts, [uid]: Math.max(myCountBefore - 1, 0) },
        },
      });

      try {
        // Nosūta informāciju serverim par nospēlēto kārti
        await playCardApi(room.id, card);
      } catch (err) {
        console.error('Failed to play card:', err);
        if (lastSnapshotRef.current) {
          dispatch({ type: 'SERVER_SYNC', payload: lastSnapshotRef.current });
        }
        toast.error((err as Error)?.message ?? 'Failed to play card.');
      }
    },
    [isMyTurn, room.id, uid, toast],
    
  );

// Keep a ref to avoid double-click spam
const pickingUpRef = useRef(false);

const pickupCard = useCallback(async () => {
  if (!isMyTurn || pickingUpRef.current) return null;
  pickingUpRef.current = true;

  try {
    const data = await pickupCardApi(room.id);

    startTransition(() => {
      dispatch({
        type: 'SERVER_SYNC',
        payload: {
          hand: data.hand ?? gameRef.current.hand,
          handCounts: data.hand_counts ?? gameRef.current.handCounts,
          deckCount: typeof data.deck_count === 'number' ? data.deck_count : gameRef.current.deckCount,
          topCard: (data.used_cards ?? []).at(-1) ?? gameRef.current.topCard,
        },
      });
      if (typeof data.current_turn === 'number') {
        dispatch({ type: 'SET_TURN', turn: data.current_turn });
      }
    });

    return data;
  } catch (err) {
    console.error('Failed to pick up card:', err);
    toast.error((err as Error)?.message ?? 'Failed to pick up card.');
    return null;
  } finally {
    pickingUpRef.current = false;
  }
}, [isMyTurn, room.id, toast]);

  const startGame = useCallback(() => {
    if (isStartingGame) return;
    setIsStartingGame(true);

    const typedEcho = getTypedEcho(echo);
    router.post(
      `/board/${room.id}/start-game`,
      {},
      {
        preserveState: true,
        headers: { 'X-Socket-Id': typedEcho?.socketId() ?? '' },
        onError: () => setIsStartingGame(false),
        onFinish: () => setTimeout(() => setIsStartingGame(false), 2500),
      },
    );
  }, [isStartingGame, room.id]);

  const leaveGame = useCallback(() => {
    console.log('Leaving...');
    router.visit('/findRoom');
  }, []);
   

const canPlayCard = useCallback(
  (card: string) =>
    isMyTurn &&
    !turnExpiredRef.current &&
    turnTimeLeft > 0 &&
    isValidPlay(card, gameRef.current.topCard),
  [isMyTurn, turnTimeLeft]
);

// Guarded play: ignore clicks when not my turn, invalid, or turn has expired
const onPlay = useCallback(
  (card: string) => {
    if (!canPlayCard(card)) return;
    playCard(card);
  },
  [canPlayCard, playCard]
);

// Guarded pickup: ignore clicks when not my turn or turn has already expired
const onPickup = useCallback(() => {
  if (!isMyTurn || turnExpiredRef.current || turnTimeLeft <= 0) return;
  pickupCard();
}, [isMyTurn, pickupCard, turnTimeLeft]);

const handleTurnExpiry = useCallback(async () => {
  try {
    const data = await pickupCard();
    if (data && data.current_turn === userId) {
      await passTurn();
    }
  } catch (err) {
    console.error('Turn expiry handling failed:', err);
  }
}, [pickupCard, passTurn, userId]);

useEffect(() => {
  if (turnTimeLeft !== 0 || !isMyTurn || game.status !== 'in_progress') return;
  if (turnExpiredRef.current || turnJustStartedRef.current) return;

  turnExpiredRef.current = true;
  toast.error('Time is up! Your turn has ended.');
  handleTurnExpiry();
}, [turnTimeLeft, isMyTurn, game.status, handleTurnExpiry, toast]);

const playAgain = useCallback(async () => {
  try {
    await resetGameApi(room.id);
    // game-reset event will arrive; reducer will update state automatically
  } catch (e) {
    console.error('reset failed', e);
  }
}, [room.id]);


// --- Derived seating & counts (number -> string safe) ---
const connectedPlayersLite: PlayerLite[] = useMemo(
  () =>
    uniqById(connectedPlayers).map((p) => ({
      id: String(p.id),
      name: p.name,
    })),
  [connectedPlayers]
);

// Seats: left/top/right (+ overflow) relative to the local user
const seats = useMemo(
  () => getSeats(connectedPlayersLite, String(userId)),
  [connectedPlayersLite, userId]
);

// Helper: is it this seat's turn?
const isSeatTurn = useCallback(
  (pid?: string | null) => {
    if (!pid || game.currentTurn == null) return false;
    return String(game.currentTurn) === pid;
  },
  [game.currentTurn]
);

// Card counts for each visible seat (handCounts has string keys)
const leftCount  = seats.left  ? (game.handCounts[seats.left.id]  ?? 0) : 0;
const topCount   = seats.top   ? (game.handCounts[seats.top.id]   ?? 0) : 0;
const rightCount = seats.right ? (game.handCounts[seats.right.id] ?? 0) : 0;



  return (
    <AppLayout>
      <Head title="Game" />
      <div
        className="
          h-screen w-full grid
          /* Mobile-first: single column stack */
          grid-cols-1 grid-rows-[auto_auto_1fr_auto]
          /* Desktop: 3 columns slim sides */
          md:grid-rows-[auto_1fr_auto]
          md:grid-cols-[96px_minmax(0,1fr)_96px]
          lg:grid-cols-[112px_minmax(0,1fr)_112px]
          gap-3 md:gap-4 p-3 md:p-4
          bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white relative overflow-hidden
          pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]
        "
      >
        {/* TOP opponent (row 1, center col) */}
        <div
          className="
            row-start-1 col-start-1 md:col-start-2
            min-w-0 min-h-[150px] md:min-h-[150px]
            flex items-center justify-center
            [container-type:inline-size]  /* enables cqi for OpponentHandRail top width */
          "
        >
          {seats.top ? (
            <OpponentHandRail
              side="top"
              handCount={topCount}
              isTurn={isSeatTurn(seats.top.id)}
              label={
                <div className="flex items-center gap-2">
                  <span className="opacity-90">{seats.top.name ?? `Player ${seats.top.id}`}</span>
                  <span className="bg-black/40 rounded px-1.5 py-0.5">{topCount}</span>
                  {seats.overflow.length > 0 ? (
                    <span title={seats.overflow.map(p => p.name ?? p.id).join(', ')}>
                      +{seats.overflow.length}
                    </span>
                  ) : null}
                </div>
              }
            />
          ) : (
            <div className="opacity-60 text-sm">Waiting for players…</div>
          )}
        </div>

        {/* MOBILE-ONLY: inline opponents strip (row 2) */}
        <div className="md:hidden row-start-2 col-start-1">
          <div className="flex items-center gap-3 overflow-x-auto scrollbar-none px-1 touch-pan-y">
            {seats.left && (
              <div className="[container-type:inline-size]">
                <OpponentHandRail
                  side="left"
                  handCount={leftCount}
                  isTurn={isSeatTurn(seats.left.id)}
                  label={
                    <div className="flex items-center gap-2">
                      <span className="opacity-90">{seats.left.name ?? `Player ${seats.left.id}`}</span>
                      <span className="bg-black/40 rounded px-1.5 py-0.5">{leftCount}</span>
                    </div>
                  }
                />
              </div>
            )}
            {seats.right && (
              <div className="[container-type:inline-size]">
                <OpponentHandRail
                  side="right"
                  handCount={rightCount}
                  isTurn={isSeatTurn(seats.right.id)}
                  label={
                    <div className="flex items-center gap-2">
                      <span className="opacity-90">{seats.right.name ?? `Player ${seats.right.id}`}</span>
                      <span className="bg-black/40 rounded px-1.5 py-0.5">{rightCount}</span>
                    </div>
                  }
                />
              </div>
            )}
          </div>
        </div>

        {/* DESKTOP LEFT opponent */}
        <div className="hidden md:flex row-start-2 col-start-1 min-w-0 items-center justify-center">
          {seats.left ? (
            <OpponentHandRail
              side="left"
              handCount={leftCount}
              isTurn={isSeatTurn(seats.left.id)}
              label={
                <div className="flex items-center gap-2">
                  <span className="opacity-90">{seats.left.name ?? `Player ${seats.left.id}`}</span>
                  <span className="bg-black/40 rounded px-1.5 py-0.5">{leftCount}</span>
                </div>
              }
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center opacity-50 text-sm"></div>
          )}
        </div>

        {/* CENTER table */}
        <div className="row-start-3 md:row-start-2 col-start-1 md:col-start-2 min-w-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-6">
            <div className="flex gap-12 items-center justify-center flex-wrap">
              <Deck isMyTurn={isMyTurn && !turnExpiredRef.current && turnTimeLeft > 0} pickupCard={onPickup} />
              <TopCard topCard={game.topCard} />
            </div>

            {game.currentTurn != null && (
              <div className="text-xs opacity-80 space-y-1 text-center">
                <div>
                  Turn:{' '}
                  <span className="font-semibold">
                    {game.currentTurn === userId ? 'You' : `Player ${game.currentTurn}`}
                  </span>
                </div>
                <div className="text-sm text-indigo-600 dark:text-indigo-300">
                  {game.currentTurn === userId ? 'Your turn' : 'Time remaining'}: {turnTimeLeft}s
                </div>
              </div>
            )}
          </div>
        </div>

        {/* DESKTOP RIGHT opponent */}
        <div className="hidden md:flex row-start-2 col-start-3 min-w-0 items-center justify-center">
          {seats.right ? (
            <OpponentHandRail
              side="right"
              handCount={rightCount}
              isTurn={isSeatTurn(seats.right.id)}
              label={
                <div className="flex items-center gap-2">
                  <span className="opacity-90">{seats.right.name ?? `Player ${seats.right.id}`}</span>
                  <span className="bg-black/40 rounded px-1.5 py-0.5">{rightCount}</span>
                </div>
              }
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center opacity-50 text-sm"></div>
          )}
        </div>

        {/* BOTTOM: your hand + controls */}
        <div className="row-start-4 md:row-start-3 col-span-1 md:col-span-3 flex flex-col items-center gap-3">
          <PlayerHand
            hand={game.hand}
            topCard={game.topCard}
            isMyTurn={isMyTurn}
            playCard={onPlay}
            minSliver={6}
            maxStepFrac={0.7}
          />
          <div className="w-full max-w-5xl">
            <GameControls
              roomId={room.id}
              isStartingGame={false}
              connectedPlayers={connectedPlayers}
              isChatOpen={isChatOpen}
              toggleChat={() => setIsChatOpen((open) => !open)}
              leaveGame={leaveGame}
              startGame={startGame}
              currentTurn={game.currentTurn}
            />
          </div>
        </div>

        <RoomChat roomId={room.id} isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
      </div>

      {game.status === 'finished' && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
          <div className="bg-black rounded-lg p-6 w-full max-w-md text-center space-y-4 shadow-xl">
            <h2 className="text-2xl font-bold">
              {game.winnerId === userId ? 'You win! 🎉' : 'Game over'}
            </h2>

            {game.winnerId !== userId && game.winnerId != null && (
              <p className="text-gray-300">Winner: Player {game.winnerId}</p>
            )}

            <div className="flex gap-3 justify-center">
              <button
                className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700"
                onClick={playAgain}
              >
                Play again
              </button>
              <button
                className="px-4 py-2 rounded bg-red-500 hover:bg-red-600 text-white"
                onClick={leaveGame}
              >
                Leave
              </button>
            </div>

            <p className="text-sm text-gray-400">
              “Play again” resets to Waiting so you can press Start.
            </p>
          </div>
        </div>
      )}
    </AppLayout>
  );
};