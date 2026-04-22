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
import { CardView } from '@/components/Board/CardView';

import echo from '@/lib/echo';
import { isValidPlay, uniqById } from '@/utils/gameLogic';
import { playCardApi, pickupCardApi, passTurnApi, resyncStateApi, resetGameApi} from '@/utils/api';
import { getTypedEcho } from '@/types/echo';
import { useToast } from '@/hooks/useToast';

import { OpponentHandRail } from '@/components/Board/OpponentHandRail';
import { getSeats } from '@/utils/getSeats';

type PlayerLite = { id: string; name?: string };

// ---------- Types ----------
type Player = { id: number; name?: string; role?: string };

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
  usedCards?: string[];
  handCounts?: Record<string, number>;
  myHand?: string[];
  gameStatus?: 'waiting' | 'in_progress' | 'finished';
  currentTurn?: number | null;
  winnerId?: number | null;
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
  players?: Array<{ id: number; name?: string; role?: string }>;
};

type CardPlayedPayload = {
  player_id?: number;
  card?: string;
  usedCards?: string[];
  handCounts?: Record<string, number>;
  deckCount?: number;
  turnPlayerId?: number;
  used_cards?: string[];
  hand_counts?: Record<string, number>;
  deck_count?: number;
  turn_player_id?: number;
};

type PresenceMember = {
  id: number;
  name?: string;
};

type HandSyncedPayload = {
  user_id?: number;
  userId?: number;
  hand?: string[];
  handCounts?: Record<string, number>;
  hand_counts?: Record<string, number>;
  deckCount?: number;
  deck_count?: number;
  usedCards?: string[];
  used_cards?: string[];
  turnPlayerId?: number | null;
  turn_player_id?: number | null;
};

type GameFinishedPayload = {
  winnerId?: number | null;
  winner_id?: number | null;
  handCounts?: Record<string, number>;
  hand_counts?: Record<string, number>;
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

type FlyingCard = {
  card: string;
  from: 'player' | 'bot' | 'peer';
};

const getAddedCards = (previousHand: string[], nextHand: string[]): string[] => {
  const counts = new Map<string, number>();
  for (const card of previousHand) {
    counts.set(card, (counts.get(card) ?? 0) + 1);
  }

  const added: string[] = [];
  for (const card of nextHand) {
    const current = counts.get(card) ?? 0;
    if (current > 0) {
      counts.set(card, current - 1);
    } else {
      added.push(card);
    }
  }

  return added;
};

export default function Board() {
  const { props } = usePage<Props>();
  const { room, deck, usedCards, handCounts, myHand, gameStatus, currentTurn, winnerId, userId } = props;
  const uid = String(userId);
  const toast = useToast();

  const [game, dispatch] = useReducer(gameReducer, {
    hand: myHand ?? [],
    deckCount: deck?.length ?? 0,
    topCard: usedCards?.at(-1) ?? null,
    handCounts: handCounts ?? {},
    currentTurn: currentTurn ?? null,
    status: gameStatus ?? 'waiting',
    winnerId: winnerId ?? null,
  });

  const turnTimeoutSeconds = room.rules.turn_timeout_seconds ?? 5;
  const [turnTimeLeft, setTurnTimeLeft] = useState(turnTimeoutSeconds);
  const turnExpiredRef = useRef(false);
  const [placingCard, setPlacingCard] = useState<string | null>(null);
  const [isPlacementLocked, setIsPlacementLocked] = useState(false);
  const [isBotActionPending, setIsBotActionPending] = useState(false);
  const [drawnCards, setDrawnCards] = useState<string[]>([]);
  const [showDrawnPlayOption, setShowDrawnPlayOption] = useState(false);
  const [drawDecisionTimeLeft, setDrawDecisionTimeLeft] = useState(5);
  const [flyingCard, setFlyingCard] = useState<FlyingCard | null>(null);
  const [isFlying, setIsFlying] = useState(false);
  const placementTimeoutRef = useRef<number | null>(null);
  const botActionAvailableAtRef = useRef(0);
  const botActionTimeoutsRef = useRef<number[]>([]);
  const pendingBotActionsRef = useRef(0);

  const clearPlacementTimeout = useCallback(() => {
    if (placementTimeoutRef.current !== null) {
      window.clearTimeout(placementTimeoutRef.current);
      placementTimeoutRef.current = null;
    }
  }, []);

  const beginPlacement = useCallback(
    (card: string | null, durationMs = 700, from: FlyingCard['from'] = 'peer') => {
      clearPlacementTimeout();
      setPlacingCard(card);
      setIsPlacementLocked(true);
      if (card) {
        setFlyingCard({ card, from });
        setIsFlying(false);
        window.requestAnimationFrame(() => setIsFlying(true));
      }

      placementTimeoutRef.current = window.setTimeout(() => {
        setPlacingCard(null);
        setFlyingCard(null);
        setIsFlying(false);
        setIsPlacementLocked(false);
        placementTimeoutRef.current = null;
      }, durationMs);
    },
    [clearPlacementTimeout],
  );

  useEffect(
    () => () => {
      clearPlacementTimeout();
      for (const id of botActionTimeoutsRef.current) {
        window.clearTimeout(id);
      }
      botActionTimeoutsRef.current = [];
      pendingBotActionsRef.current = 0;
      setIsBotActionPending(false);
    },
    [clearPlacementTimeout],
  );

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
    if (game.currentTurn == null || game.status !== 'in_progress' || isPlacementLocked || isBotActionPending || showDrawnPlayOption) return;

    const timer = window.setInterval(() => {
      setTurnTimeLeft((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [game.currentTurn, game.status, isPlacementLocked, isBotActionPending, showDrawnPlayOption]);

  useEffect(() => {
    if (!showDrawnPlayOption) return;

    setDrawDecisionTimeLeft(5);
    const timer = window.setInterval(() => {
      setDrawDecisionTimeLeft((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [showDrawnPlayOption]);

  useEffect(() => {
    if (!showDrawnPlayOption || drawDecisionTimeLeft > 0) return;

    setShowDrawnPlayOption(false);
    setDrawnCards([]);
    if (game.currentTurn === userId) {
      passTurnApi(room.id)
        .then((data) => {
          if (typeof data.current_turn === 'number') {
            dispatch({ type: 'SET_TURN', turn: data.current_turn });
          }
        })
        .catch((error) => {
          console.error('draw decision auto-keep failed', error);
          toast.error('Unable to keep drawn card automatically.');
        });
    }
  }, [drawDecisionTimeLeft, game.currentTurn, room.id, showDrawnPlayOption, toast, userId]);

  const [connectedPlayers, setConnectedPlayers] = useState<Player[]>(room.players ?? []);
  const connectedPlayersRef = useRef<Player[]>(room.players ?? []);
  const staticRoomPlayersRef = useRef<Player[]>(room.players ?? []);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isStartingGame, setIsStartingGame] = useState(false);
  const isMyTurn = useMemo(() => game.currentTurn === userId, [game.currentTurn, userId]);

  useEffect(() => {
    if (!showDrawnPlayOption) return;
    if (!isMyTurn) {
      setShowDrawnPlayOption(false);
      setDrawnCards([]);
    }
  }, [isMyTurn, showDrawnPlayOption]);

  useEffect(() => {
    staticRoomPlayersRef.current = room.players ?? [];
    connectedPlayersRef.current = room.players ?? [];
    setConnectedPlayers(room.players ?? []);
  }, [room.players]);

  useEffect(() => {
    connectedPlayersRef.current = connectedPlayers;
  }, [connectedPlayers]);

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
    const data = raw as GameStartedPayload;
    const eventHandCounts = data.hand_counts ?? data.handCounts ?? {};
    const eventUsedCards = data.used_cards ?? data.usedCards ?? [];
    const eventTurn =
      typeof data.turn_player_id === 'number'
        ? data.turn_player_id
        : typeof data.turnPlayerId === 'number'
          ? data.turnPlayerId
          : null;

    dispatch({
      type: 'SERVER_SYNC',
      payload: {
        deckCount: data.deck_count ?? data.deckCount ?? 0,
        handCounts: eventHandCounts,
        topCard: eventUsedCards.at(-1) ?? gameRef.current.topCard,
        status: 'in_progress',
      },
    });
    dispatch({ type: 'SET_TURN', turn: eventTurn });

    if (Array.isArray(data.players) && data.players.length) {
      const mergedPlayers = uniqById([...(staticRoomPlayersRef.current ?? []), ...data.players]);
      staticRoomPlayersRef.current = mergedPlayers;
      setConnectedPlayers(mergedPlayers);
    }

    setIsStartingGame(false);
  };

  const onCardPlayed = (raw: unknown) => {
    const data = raw as CardPlayedPayload;
    const actorId = typeof data.player_id === 'number' ? data.player_id : null;
    const playedCard = typeof data.card === 'string' ? data.card : '';
    const isBotActor =
      actorId !== null && connectedPlayersRef.current.some((p) => p.id === actorId && p.role === 'bot');

    const used = data.used_cards ?? data.usedCards ?? [];
    const eventHandCounts = data.hand_counts ?? data.handCounts;
    const eventDeckCount =
      typeof data.deck_count === 'number'
        ? data.deck_count
        : typeof data.deckCount === 'number'
          ? data.deckCount
          : undefined;
    const eventTurn =
      typeof data.turn_player_id === 'number'
        ? data.turn_player_id
        : typeof data.turnPlayerId === 'number'
          ? data.turnPlayerId
          : null;

    const applyCardPlayed = () => {
      if (playedCard) {
        beginPlacement(playedCard, isBotActor ? 900 : 720, isBotActor ? 'bot' : 'peer');
      }

      const patch: Partial<GameState> = {};
      if (used.length) patch.topCard = used[used.length - 1];
      if (eventHandCounts) patch.handCounts = eventHandCounts;
      if (typeof eventDeckCount === 'number') patch.deckCount = eventDeckCount;

      if (Object.keys(patch).length) dispatch({ type: 'SERVER_SYNC', payload: patch });
      if (eventTurn !== null) dispatch({ type: 'SET_TURN', turn: eventTurn });
    };

    if (!isBotActor) {
      applyCardPlayed();
      return;
    }

    const now = Date.now();
    const nextAt = Math.max(now, botActionAvailableAtRef.current) + 1100;
    botActionAvailableAtRef.current = nextAt;
    const delay = Math.max(0, nextAt - now);

    pendingBotActionsRef.current += 1;
    setIsBotActionPending(true);

    const timeoutId = window.setTimeout(() => {
      applyCardPlayed();
      pendingBotActionsRef.current = Math.max(0, pendingBotActionsRef.current - 1);
      if (pendingBotActionsRef.current === 0) {
        setIsBotActionPending(false);
      }
      botActionTimeoutsRef.current = botActionTimeoutsRef.current.filter((id) => id !== timeoutId);
    }, delay);

    botActionTimeoutsRef.current.push(timeoutId);
  };

  const onHandSynced = (raw: unknown) => {
    const d = raw as HandSyncedPayload;
    const syncedUserId = d.user_id ?? d.userId;
    if (syncedUserId !== userId) return;
    const eventHandCounts = d.hand_counts ?? d.handCounts;
    const eventUsedCards = d.used_cards ?? d.usedCards;
    const eventDeckCount =
      typeof d.deck_count === 'number'
        ? d.deck_count
        : typeof d.deckCount === 'number'
          ? d.deckCount
          : gameRef.current.deckCount;
    const eventTurn =
      typeof d.turn_player_id === 'number'
        ? d.turn_player_id
        : typeof d.turnPlayerId === 'number'
          ? d.turnPlayerId
          : null;

    startTransition(() => {
      dispatch({
        type: 'SERVER_SYNC',
        payload: {
          hand: d.hand ?? gameRef.current.hand,
          handCounts: eventHandCounts ?? gameRef.current.handCounts,
          deckCount: eventDeckCount,
          topCard: (eventUsedCards ?? []).at(-1) ?? gameRef.current.topCard,
        },
      });
      if (eventTurn !== null) dispatch({ type: 'SET_TURN', turn: eventTurn });
    });
  }

  const onGameFinished = (raw: unknown) => {
    const d = raw as GameFinishedPayload;
    const winner =
      typeof d.winner_id === 'number'
        ? d.winner_id
        : typeof d.winnerId === 'number'
          ? d.winnerId
          : null;
    const eventHandCounts = d.hand_counts ?? d.handCounts;

    dispatch({
      type: 'SERVER_SYNC',
      payload: {
        status: 'finished',
        winnerId: winner,
        handCounts: eventHandCounts ?? gameRef.current.handCounts,
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

    channel.here((members: PresenceMember[]) => {
      const players: Player[] = (members ?? []).map((m) => ({
        id: m.id,
        name: m.name ?? `Player ${m.id}`,
      }));
      setConnectedPlayers(uniqById([...(staticRoomPlayersRef.current ?? []), ...players]));
    });

    channel.joining((member: PresenceMember) => {
      const player: Player = { id: member.id, name: member.name ?? `Player ${member.id}` };
      setConnectedPlayers((prev) => uniqById([...(prev ?? []), player]));
    });

    channel.leaving((member: PresenceMember) => {
      setConnectedPlayers((prev) => {
        const withoutLeaving = (prev ?? []).filter((p) => p.id !== member.id);
        const bots = (staticRoomPlayersRef.current ?? []).filter((p) => p.role === 'bot');

        return uniqById([...bots, ...withoutLeaving]);
      });
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
        beginPlacement(card, 720, 'player');
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
    [isMyTurn, room.id, uid, toast, beginPlacement],
    
  );

// Keep a ref to avoid double-click spam
const pickingUpRef = useRef(false);

const pickupCard = useCallback(async () => {
  if (!isMyTurn || pickingUpRef.current) return null;
  pickingUpRef.current = true;

  try {
    const previousHand = [...gameRef.current.hand];
    const data = await pickupCardApi(room.id);
    const syncedHand = data.hand ?? gameRef.current.hand;
    const addedCards = getAddedCards(previousHand, syncedHand);

    // Check if any of the drawn cards are playable
    const topCardAfterDrawing = (data.used_cards ?? []).at(-1) ?? gameRef.current.topCard;
    const playableDrawn = addedCards.filter((c: string) => isValidPlay(c, topCardAfterDrawing));

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

    // Show play/pass option if cards are playable and it's still my turn
    if (playableDrawn.length > 0 && data.current_turn === userId) {
      setDrawnCards(playableDrawn);
      setShowDrawnPlayOption(true);
      turnExpiredRef.current = false;
      setTurnTimeLeft((current) => Math.max(current, 5));
    }

    return data;
  } catch (err) {
    console.error('Failed to pick up card:', err);
    toast.error((err as Error)?.message ?? 'Failed to pick up card.');
    return null;
  } finally {
    pickingUpRef.current = false;
  }
}, [isMyTurn, room.id, toast, userId]);

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
    router.delete(`/leaveroom/${room.id}`);
  }, [room.id]);
   

const canPlayCard = useCallback(
  (card: string) =>
    isMyTurn &&
    !showDrawnPlayOption &&
    !isPlacementLocked &&
    !isBotActionPending &&
    !turnExpiredRef.current &&
    turnTimeLeft > 0 &&
    isValidPlay(card, gameRef.current.topCard),
  [isMyTurn, turnTimeLeft, isPlacementLocked, isBotActionPending, showDrawnPlayOption]
);

// Guarded play: ignore clicks when not my turn, invalid, or turn has expired
const onPlay = useCallback(
  (card: string) => {
    if (showDrawnPlayOption && drawnCards[0] !== card) return;
    if (!canPlayCard(card)) return;
    playCard(card);
  },
  [canPlayCard, playCard, showDrawnPlayOption, drawnCards]
);

// Guarded pickup: ignore clicks when not my turn or turn has already expired
const onPickup = useCallback(() => {
  if (!isMyTurn || turnExpiredRef.current || turnTimeLeft <= 0 || isPlacementLocked || isBotActionPending || showDrawnPlayOption) return;
  pickupCard();
}, [isMyTurn, pickupCard, turnTimeLeft, isPlacementLocked, isBotActionPending, showDrawnPlayOption]);

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
  if (isPlacementLocked || isBotActionPending || showDrawnPlayOption) return;
  if (turnTimeLeft !== 0 || !isMyTurn || game.status !== 'in_progress') return;
  if (turnExpiredRef.current || turnJustStartedRef.current) return;

  turnExpiredRef.current = true;
  toast.error('Time is up! Your turn has ended.');
  handleTurnExpiry();
}, [turnTimeLeft, isMyTurn, game.status, handleTurnExpiry, toast, isPlacementLocked, isBotActionPending, showDrawnPlayOption]);

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

const placementCard = placingCard;

  return (
    <AppLayout>
      <Head title="Game" />
      <div
        className="
          min-h-[100dvh] w-full grid
          /* Mobile-first: single column stack */
          grid-cols-1 grid-rows-[auto_auto_1fr_auto]
          /* Desktop: 3 columns slim sides */
          md:grid-rows-[auto_1fr_auto]
          md:grid-cols-[96px_minmax(0,1fr)_96px]
          lg:grid-cols-[112px_minmax(0,1fr)_112px]
          gap-3 md:gap-4 p-3 md:p-4
          bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white relative overflow-hidden
          pt-[max(env(safe-area-inset-top),8px)] pb-[max(env(safe-area-inset-bottom),12px)]
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
          <div className="flex flex-col items-center gap-4 md:gap-6">
            <div className="relative flex gap-8 md:gap-12 items-center justify-center flex-wrap">
              {placementCard && flyingCard && isPlacementLocked && (
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
                  <CardView card={placementCard} disabled className="w-10 h-14 sm:w-12 sm:h-16 shadow-2xl" />
                </div>
              )}
              <Deck isMyTurn={isMyTurn && !turnExpiredRef.current && turnTimeLeft > 0 && !isPlacementLocked && !isBotActionPending} pickupCard={onPickup} />
              <TopCard topCard={game.topCard} isPlacing={isPlacementLocked} />

              {showDrawnPlayOption && drawnCards.length > 0 && (
                <div className="absolute -top-32 left-1/2 z-40 -translate-x-1/2">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      const playCandidate = drawnCards[0];
                      setShowDrawnPlayOption(false);
                      setDrawnCards([]);
                      if (playCandidate) {
                        playCard(playCandidate);
                      }
                    }}
                    className="rounded-lg transition hover:-translate-y-1"
                    title="Play drawn card"
                  >
                    <CardView card={drawnCards[0]} className="w-14 h-20 shadow-2xl ring-2 ring-cyan-300" />
                  </button>
                  <p className="mt-1 text-center text-[11px] text-cyan-200">Tap card to play • {drawDecisionTimeLeft}s</p>
                </div>
              )}

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
                  {game.currentTurn === userId ? 'Your turn' : 'Opponent turn'}: {turnTimeLeft}s
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
        <div className="row-start-4 md:row-start-3 col-span-1 md:col-span-3 flex flex-col items-center gap-3 pb-2 md:pb-0">
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
              isStartingGame={isStartingGame}
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
          <div className="bg-zinc-950 text-zinc-100 rounded-lg p-6 w-full max-w-md text-center space-y-4 shadow-xl border border-white/10">
            <h2 className="text-2xl font-bold">
              {game.winnerId === userId ? 'You win! 🎉' : 'Game over'}
            </h2>

            {game.winnerId !== userId && game.winnerId != null && (
              <p className="text-zinc-300">Winner: Player {game.winnerId}</p>
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

            <p className="text-sm text-zinc-400">
              “Play again” resets to Waiting so you can press Start.
            </p>
          </div>
        </div>
      )}
      {showDrawnPlayOption && drawnCards.length > 0 && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => {
            setShowDrawnPlayOption(false);
            setDrawnCards([]);
            if (game.currentTurn === userId) {
              passTurn();
            }
          }}
        />
      )}
    </AppLayout>
  );
};