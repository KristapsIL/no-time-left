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
import { router, usePage } from '@inertiajs/react';

import AppLayout from '@/layouts/app-layout';
import RoomChat from '@/components/RoomChat';
import { PlayerHand } from '@/components/Board/PlayerHand';
import { Deck } from '@/components/Board/Deck';
import { TopCard } from '@/components/Board/TopCard';
import { GameControls } from '@/components/Board/GameControls';

import echo from '@/lib/echo';
import { isValidPlay } from '@/utils/gameLogic';
import { playCardApi, pickupCardApi, resyncStateApi, resetGameApi} from '@/utils/api';

import { OpponentHandRail } from '@/components/Board/OpponentHandRail';
import { getSeats } from '@/utils/getSeats';

type PlayerLite = { id: string; name?: string };


// ---------- Types ----------
type Player = { id: number; name?: string };

type RoomRules = {
  public: boolean;
  max_players: number;
  rules: string[];
};

type Room = {
  id: number;
  code: string;
  rules: RoomRules;
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

// ---------- Helpers ----------
function uniqById<T extends { id?: string | number; user_id?: string | number }>(arr: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of arr) {
    const raw = item.id ?? item.user_id;
    if (raw !== undefined) map.set(String(raw), item);
  }
  return [...map.values()];
}

// ---------- Reducer ----------
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

// Echo channel (minimal typing)
type AnyChannel = {
  here: (cb: (members: unknown[]) => void) => AnyChannel;
  joining: (cb: (member: unknown) => void) => AnyChannel;
  leaving: (cb: (member: unknown) => void) => AnyChannel;
  listen: (event: string, cb: (payload: unknown) => void) => AnyChannel;
  stopListening: (event: string) => AnyChannel;
};

export default function Board() {
  const { props } = usePage<Props>();
  const { room, deck, userId } = props;
  const uid = String(userId);

  const [game, dispatch] = useReducer(gameReducer, {
    hand: room.player_hands?.[uid] ?? [],
    deckCount: deck?.length ?? 0,
    topCard: room.used_cards?.at(-1) ?? null,
    handCounts: {},
    currentTurn: null,
  });

  // Keep a ref to the latest game state for async handlers
  const gameRef = useRef(game);
  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  const [connectedPlayers, setConnectedPlayers] = useState<Player[]>(room.players ?? []);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isStartingGame, setIsStartingGame] = useState(false);
  const isMyTurn = useMemo(() => game.currentTurn === userId, [game.currentTurn, userId]);

  // ----- Event handlers (accept unknown, cast inside) -----
  const onGameStarted = (raw: unknown) => {
    const data = raw as GameStartedPayload;
    const turn = data.turnPlayerId ?? data.turn_player_id ?? null;
    const deckC = data.deckCount ?? data.deck_count ?? 0;
    const counts = data.handCounts ?? data.hand_counts ?? {};
    const used = (data.usedCards ?? data.used_cards) ?? [];

    dispatch({
      type: 'SERVER_SYNC',
      payload: {
        deckCount: deckC,
        handCounts: counts,
        topCard: used.at(-1) ?? gameRef.current.topCard,
      },
    });
    dispatch({ type: 'SET_TURN', turn });
    setIsStartingGame(false);
  };

  const onCardPlayed = (raw: unknown) => {
    const data = raw as CardPlayedPayload;
    const used = (data.usedCards ?? data.used_cards) ?? [];
    const latestTop = used.length ? used[used.length - 1] : undefined;
    const counts = data.handCounts ?? data.hand_counts;
    const deckC = data.deckCount ?? data.deck_count;
    const turn = data.turnPlayerId ?? data.turn_player_id;

    const patch: Partial<GameState> = {};
    if (latestTop) patch.topCard = latestTop;
    if (counts) patch.handCounts = { ...counts };
    if (typeof deckC === 'number') patch.deckCount = deckC;

    if (Object.keys(patch).length) dispatch({ type: 'SERVER_SYNC', payload: patch });
    if (typeof turn === 'number') dispatch({ type: 'SET_TURN', turn });
  };

  const onHandSynced = (raw: unknown) => {
    const d = raw as any;
    const id = d.userId ?? d.user_id;
    if (id !== userId) return;

    startTransition(() => {
      dispatch({
        type: 'SERVER_SYNC',
        payload: {
          hand: Array.isArray(d.hand) ? d.hand : gameRef.current.hand,
          handCounts: d.hand_counts ?? gameRef.current.handCounts,
          deckCount: typeof d.deck_count === 'number' ? d.deck_count : gameRef.current.deckCount,
          topCard: (d.used_cards ?? []).at(-1) ?? gameRef.current.topCard,
        },
      });
      const turn = d.turnPlayerId ?? d.turn_player_id;
      if (typeof turn === 'number') dispatch({ type: 'SET_TURN', turn });
    });
  }

  const onGameFinished = (raw: unknown) => {
    const d = raw as any;
    const winner = d.winner_id ?? d.winnerId;
    console.log('Game finished payload:', d);

    dispatch({
      type: 'SERVER_SYNC',
      payload: {
        status: 'finished',
        winnerId: winner ?? null,
        handCounts: d.hand_counts ?? d.handCounts ?? gameRef.current.handCounts,
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
    if (!echo) return;

    const channel = (echo as any).join?.(`room-${room.id}`) as AnyChannel | undefined;
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
        (echo as any).leave?.(`room-${room.id}`);
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
  const lastSnapshotRef = useRef<GameState | null>(null);

  const playCard = useCallback(
    async (card: string) => {
      if (!isMyTurn || !isValidPlay(card, gameRef.current.topCard)) return;

      // Snapshot before optimistic update
      lastSnapshotRef.current = gameRef.current;

      // Optimistic remove one card + set top card + adjust my count; do NOT touch deckCount
      const cur = gameRef.current;
      const idx = cur.hand.indexOf(card);
      const nextHand = idx >= 0 ? [...cur.hand.slice(0, idx), ...cur.hand.slice(idx + 1)] : cur.hand;
      const myCountBefore = cur.handCounts[uid] ?? cur.hand.length;

      dispatch({
        type: 'SERVER_SYNC',
        payload: {
          hand: nextHand,
          topCard: card,
          handCounts: { ...cur.handCounts, [uid]: Math.max(myCountBefore - 1, 0) },
        },
      });

      try {
        await playCardApi(room.id, card);
        // success: server will broadcast .card-played; nothing else needed
      } catch (err) {
        console.error('Failed to play card:', err);
        if (lastSnapshotRef.current) {
          dispatch({ type: 'SERVER_SYNC', payload: lastSnapshotRef.current });
        }
      }
    },
    [isMyTurn, room.id, uid],
    
  );
// Keep a ref to avoid double-click spam
const pickingUpRef = useRef(false);

const pickupCard = useCallback(async () => {
  if (!isMyTurn || pickingUpRef.current) return;
  pickingUpRef.current = true;

  try {
    const data = await pickupCardApi(room.id);

    // Case 1: server returns full state (preferred)
    if (data && Array.isArray(data.hand)) {
      startTransition(() => {
        dispatch({
          type: 'SERVER_SYNC',
          payload: {
            hand: data.hand,
            handCounts: data.hand_counts ?? gameRef.current.handCounts,
            deckCount:
              typeof data.deck_count === 'number' ? data.deck_count : gameRef.current.deckCount,
            topCard: (data.used_cards ?? []).at(-1) ?? gameRef.current.topCard,
          },
        });
      });
      return;
    }

    // Case 2: server returns only the card (and maybe counts)
    if (data && typeof data.card === 'string') {
      const cur = gameRef.current;
      startTransition(() => {
        dispatch({
          type: 'SERVER_SYNC',
          payload: {
            hand: [...cur.hand, data.card],
            handCounts: data.hand_counts ?? cur.handCounts,
            deckCount: typeof data.deck_count === 'number' ? data.deck_count : cur.deckCount,
          },
        });
      });
      return;
    }

    // Case 3: empty success (204) → resync
    const fresh = await resyncStateApi(room.id);
    startTransition(() => {
      dispatch({
        type: 'SERVER_SYNC',
        payload: {
          hand: fresh.hand ?? gameRef.current.hand,
          handCounts: fresh.hand_counts ?? gameRef.current.handCounts,
          deckCount:
            typeof fresh.deck_count === 'number' ? fresh.deck_count : gameRef.current.deckCount,
          topCard: (fresh.used_cards ?? []).at(-1) ?? gameRef.current.topCard,
        },
      });
      dispatch({ type: 'SET_TURN', turn: fresh.current_turn ?? gameRef.current.currentTurn });
    });
  } catch (err) {
    console.error('Failed to pick up card:', err);
    // No placeholder added → nothing to remove. Optionally show a toast.
  } finally {
    pickingUpRef.current = false;
  }
}, [isMyTurn, room.id]);

  const startGame = useCallback(() => {
    if (isStartingGame) return;
    setIsStartingGame(true);

    router.post(
      `/board/${room.id}/start-game`,
      {},
      {
        preserveState: true,
        headers: { 'X-Socket-Id': (echo as any)?.socketId?.() ?? '' },
        onError: () => setIsStartingGame(false),
        onFinish: () => setTimeout(() => setIsStartingGame(false), 2500),
      },
    );
  }, [isStartingGame, room.id]);

  const leaveGame = useCallback(() => {
    console.log('Leaving...');
    router.visit('/findRoom');
  }, []);

  // ----- Derived -----
  const { hand, topCard, deckCount, handCounts, currentTurn } = game;
   

const canPlayCard = useCallback(
  (card: string) => isMyTurn && isValidPlay(card, gameRef.current.topCard),
  [isMyTurn]
);

// Guarded play: ignore clicks when not my turn or invalid
const onPlay = useCallback(
  (card: string) => {
    if (!canPlayCard(card)) return;
    // call your existing playCard (which still double-checks)
    playCard(card);
  },
  [canPlayCard, playCard]
);

// Guarded pickup: ignore clicks when not my turn
const onPickup = useCallback(() => {
  if (!isMyTurn) return;
  pickupCard();
}, [isMyTurn, pickupCard]);

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
    {/* Root table grid */}
    <div
      className="
        h-screen w-full
        grid
        grid-rows-[auto_1fr_auto]
        grid-cols-[360px_minmax(0,1fr)_360px]  /* fixed sides, elastic center */
        gap-4
        p-4
        bg-emerald-800
        text-white
        relative
        overflow-hidden
      "
    >
      {/* TOP opponent (row 1, center col) */}
      <div className="row-start-1 col-start-2 min-w-0 min-h-[220px] flex items-center justify-center">
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
                  <span title={seats.overflow.map(p => p.name ?? p.id).join(', ')}>+{seats.overflow.length}</span>
                ) : null}
              </div>
            }
          />
        ) : (
          <div className="opacity-60 text-sm">Waiting for players…</div>
        )}
      </div>

      {/* LEFT opponent (row 2, left col) */}
      <div className="row-start-2 col-start-1 w-[360px] min-w-[280px]">
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
          <div className="h-full w-full flex items-center justify-center opacity-50 text-sm">—</div>
        )}
      </div>

      {/* CENTER table (row 2, center col): Deck + TopCard */}
      <div className="row-start-2 col-start-2 min-w-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <div className="flex gap-12 items-center justify-center flex-wrap">
            <Deck
              deckCount={game.deckCount}
              isMyTurn={isMyTurn}
              pickupCard={onPickup}
            />
            <TopCard topCard={game.topCard} />
          </div>

          {game.currentTurn != null && (
            <div className="text-xs opacity-80">
              Turn:{' '}
              <span className="font-semibold">
                {game.currentTurn === userId ? 'You' : `Player ${game.currentTurn}`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT opponent (row 2, right col) */}
      <div className="row-start-2 col-start-3 w-[360px] min-w-[280px]">
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
          <div className="h-full w-full flex items-center justify-center opacity-50 text-sm">—</div>
        )}
      </div>

      {/* BOTTOM: your hand + controls (row 3, span all cols) */}
      <div className="row-start-3 col-span-3 flex flex-col items-center gap-3">
        <PlayerHand
          hand={game.hand}
          topCard={game.topCard}
          isMyTurn={isMyTurn}
          playCard={onPlay}
          minSliver={6}         // tighter overlap between cards
          maxStepFrac={0.7}
        />

        <div className="w-full max-w-5xl">
          <GameControls
            roomId={room.id}
            isStartingGame={isStartingGame}
            connectedPlayers={connectedPlayers ?? []}
            isChatOpen={isChatOpen}
            toggleChat={() => setIsChatOpen((open) => !open)}
            leaveGame={leaveGame}
            startGame={startGame}
          />
        </div>
      </div>

      {/* Chat panel (keep overlay so it doesn't push layout) */}
      <RoomChat
        roomId={room.id}
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />
    </div>

    {/* Finish modal */}
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
}