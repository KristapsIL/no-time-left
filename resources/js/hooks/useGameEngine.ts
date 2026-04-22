import {
  useReducer,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
  startTransition,
} from 'react';
import { router } from '@inertiajs/react';
import echo from '@/lib/echo';
import { isValidPlay, uniqById } from '@/utils/gameLogic';
import { playCardApi, pickupCardApi, passTurnApi, resyncStateApi, resetGameApi } from '@/utils/api';
import { getTypedEcho } from '@/types/echo';
import { getSeats } from '@/utils/getSeats';

// ── Public types ────────────────────────────────────────────────────────────
export type Player = { id: number; name?: string; role?: string };
export type PlayerLite = { id: string; name?: string };

export type GameState = {
  hand: string[];
  deckCount: number;
  topCard: string | null;
  handCounts: Record<string, number>;
  currentTurn: number | null;
  status: 'waiting' | 'in_progress' | 'finished';
  winnerId: number | null | undefined;
};

export type FlyingCard = { card: string; from: 'player' | 'bot' | 'peer' };

// ── Internal types ──────────────────────────────────────────────────────────
type Action =
  | { type: 'SERVER_SYNC'; payload: Partial<GameState> }
  | { type: 'SET_TURN'; turn: number | null };

type PresenceMember = { id: number; name?: string };

export type GameEngineInput = {
  room: {
    id: number;
    rules: { turn_timeout_seconds?: number };
    players?: Player[];
  };
  userId: number;
  initialHand: string[];
  initialDeckCount: number;
  initialUsedCards: string[];
  initialHandCounts: Record<string, number>;
  initialGameStatus: 'waiting' | 'in_progress' | 'finished';
  initialCurrentTurn: number | null;
  initialWinnerId: number | null | undefined;
  toast: { error: (msg: string) => void };
};

// ── Helpers ─────────────────────────────────────────────────────────────────
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

const getAddedCards = (prev: string[], next: string[]): string[] => {
  const counts = new Map<string, number>();
  for (const c of prev) counts.set(c, (counts.get(c) ?? 0) + 1);
  const added: string[] = [];
  for (const c of next) {
    const cur = counts.get(c) ?? 0;
    if (cur > 0) counts.set(c, cur - 1);
    else added.push(c);
  }
  return added;
};

// ── Main hook ────────────────────────────────────────────────────────────────
export function useGameEngine({
  room,
  userId,
  initialHand,
  initialDeckCount,
  initialUsedCards,
  initialHandCounts,
  initialGameStatus,
  initialCurrentTurn,
  initialWinnerId,
  toast,
}: GameEngineInput) {
  const uid = String(userId);
  const turnTimeoutSeconds = room.rules.turn_timeout_seconds ?? 5;

  // ── Game state ──────────────────────────────────────────────────────────
  const [game, dispatch] = useReducer(gameReducer, {
    hand: initialHand,
    deckCount: initialDeckCount,
    topCard: initialUsedCards.at(-1) ?? null,
    handCounts: initialHandCounts,
    currentTurn: initialCurrentTurn,
    status: initialGameStatus,
    winnerId: initialWinnerId,
  });

  // ── UI / animation state ────────────────────────────────────────────────
  const [turnTimeLeft, setTurnTimeLeft] = useState(turnTimeoutSeconds);
  const [placingCard, setPlacingCard] = useState<string | null>(null);
  const [isPlacementLocked, setIsPlacementLocked] = useState(false);
  const [isBotActionPending, setIsBotActionPending] = useState(false);
  const [drawnCards, setDrawnCards] = useState<string[]>([]);
  const [showDrawnPlayOption, setShowDrawnPlayOption] = useState(false);
  const [drawDecisionTimeLeft, setDrawDecisionTimeLeft] = useState(5);
  const [flyingCard, setFlyingCard] = useState<FlyingCard | null>(null);
  const [isFlying, setIsFlying] = useState(false);
  const [connectedPlayers, setConnectedPlayers] = useState<Player[]>(room.players ?? []);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isStartingGame, setIsStartingGame] = useState(false);

  // ── Refs ────────────────────────────────────────────────────────────────
  const gameRef = useRef(game);
  const turnExpiredRef = useRef(false);
  const turnJustStartedRef = useRef(false);
  const placementTimeoutRef = useRef<number | null>(null);
  const botActionAvailableAtRef = useRef(0);
  const botActionTimeoutsRef = useRef<number[]>([]);
  const pendingBotActionsRef = useRef(0);
  const connectedPlayersRef = useRef<Player[]>(room.players ?? []);
  const staticRoomPlayersRef = useRef<Player[]>(room.players ?? []);
  const pickingUpRef = useRef(false);
  const lastSnapshotRef = useRef<GameState | null>(null);

  useEffect(() => { gameRef.current = game; }, [game]);
  useEffect(() => { connectedPlayersRef.current = connectedPlayers; }, [connectedPlayers]);
  useEffect(() => {
    staticRoomPlayersRef.current = room.players ?? [];
    connectedPlayersRef.current = room.players ?? [];
    setConnectedPlayers(room.players ?? []);
  }, [room.players]);

  // ── Placement animation ─────────────────────────────────────────────────
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

  // Cleanup on unmount
  useEffect(
    () => () => {
      clearPlacementTimeout();
      for (const id of botActionTimeoutsRef.current) window.clearTimeout(id);
      botActionTimeoutsRef.current = [];
      pendingBotActionsRef.current = 0;
      setIsBotActionPending(false);
    },
    [clearPlacementTimeout],
  );

  // ── Turn countdown ──────────────────────────────────────────────────────
  useEffect(() => {
    setTurnTimeLeft(turnTimeoutSeconds);
    turnExpiredRef.current = false;
    turnJustStartedRef.current = true;
    const t = window.setTimeout(() => { turnJustStartedRef.current = false; }, 0);
    return () => window.clearTimeout(t);
  }, [game.currentTurn, turnTimeoutSeconds]);

  useEffect(() => {
    if (
      game.currentTurn == null ||
      game.status !== 'in_progress' ||
      isPlacementLocked ||
      isBotActionPending ||
      showDrawnPlayOption
    ) return;
    const timer = window.setInterval(() => setTurnTimeLeft((c) => Math.max(c - 1, 0)), 1000);
    return () => window.clearInterval(timer);
  }, [game.currentTurn, game.status, isPlacementLocked, isBotActionPending, showDrawnPlayOption]);

  // ── Draw-decision countdown ─────────────────────────────────────────────
  useEffect(() => {
    if (!showDrawnPlayOption) return;
    setDrawDecisionTimeLeft(5);
    const timer = window.setInterval(() => setDrawDecisionTimeLeft((c) => Math.max(c - 1, 0)), 1000);
    return () => window.clearInterval(timer);
  }, [showDrawnPlayOption]);

  useEffect(() => {
    if (!showDrawnPlayOption || drawDecisionTimeLeft > 0) return;
    setShowDrawnPlayOption(false);
    setDrawnCards([]);
    if (game.currentTurn === userId) {
      passTurnApi(room.id)
        .then((d) => {
          if (typeof d.current_turn === 'number') dispatch({ type: 'SET_TURN', turn: d.current_turn });
        })
        .catch(() => toast.error('Unable to keep drawn card automatically.'));
    }
  }, [drawDecisionTimeLeft, game.currentTurn, room.id, showDrawnPlayOption, toast, userId]);

  const isMyTurn = useMemo(() => game.currentTurn === userId, [game.currentTurn, userId]);

  // Dismiss draw option when turn changes away
  useEffect(() => {
    if (!showDrawnPlayOption || isMyTurn) return;
    setShowDrawnPlayOption(false);
    setDrawnCards([]);
  }, [isMyTurn, showDrawnPlayOption]);

  // ── Actions ─────────────────────────────────────────────────────────────
  const passTurn = useCallback(async () => {
    try {
      const d = await passTurnApi(room.id);
      if (typeof d.current_turn === 'number') dispatch({ type: 'SET_TURN', turn: d.current_turn });
    } catch {
      toast.error('Unable to pass turn.');
    }
  }, [room.id, toast]);

  const playCard = useCallback(
    async (card: string) => {
      if (!isMyTurn || !isValidPlay(card, gameRef.current.topCard)) return;
      lastSnapshotRef.current = gameRef.current;
      const cur = gameRef.current;
      const idx = cur.hand.indexOf(card);
      const nextHand = idx >= 0 ? [...cur.hand.slice(0, idx), ...cur.hand.slice(idx + 1)] : cur.hand;
      dispatch({
        type: 'SERVER_SYNC',
        payload: {
          hand: nextHand,
          topCard: card,
          handCounts: { ...cur.handCounts, [uid]: Math.max((cur.handCounts[uid] ?? cur.hand.length) - 1, 0) },
        },
      });
      try {
        beginPlacement(card, 720, 'player');
        await playCardApi(room.id, card);
      } catch (err) {
        if (lastSnapshotRef.current) dispatch({ type: 'SERVER_SYNC', payload: lastSnapshotRef.current });
        toast.error((err as Error)?.message ?? 'Failed to play card.');
      }
    },
    [isMyTurn, room.id, uid, toast, beginPlacement],
  );

  const pickupCard = useCallback(async () => {
    if (!isMyTurn || pickingUpRef.current) return null;
    pickingUpRef.current = true;
    try {
      const prevHand = [...gameRef.current.hand];
      const data = await pickupCardApi(room.id);
      const syncedHand: string[] = data.hand ?? gameRef.current.hand;
      const added = getAddedCards(prevHand, syncedHand);
      const topAfter = (data.used_cards ?? []).at(-1) ?? gameRef.current.topCard;
      const playableDrawn = added.filter((c: string) => isValidPlay(c, topAfter));

      startTransition(() => {
        dispatch({
          type: 'SERVER_SYNC',
          payload: {
            hand: data.hand ?? gameRef.current.hand,
            handCounts: data.hand_counts ?? gameRef.current.handCounts,
            deckCount: typeof data.deck_count === 'number' ? data.deck_count : gameRef.current.deckCount,
            topCard: topAfter,
          },
        });
        if (typeof data.current_turn === 'number') dispatch({ type: 'SET_TURN', turn: data.current_turn });
      });

      if (playableDrawn.length > 0 && data.current_turn === userId) {
        setDrawnCards(playableDrawn);
        setShowDrawnPlayOption(true);
        turnExpiredRef.current = false;
        setTurnTimeLeft((c) => Math.max(c, 5));
      } else if (playableDrawn.length === 0 && data.current_turn === userId) {
        try {
          const pd = await passTurnApi(room.id);
          if (typeof pd.current_turn === 'number') dispatch({ type: 'SET_TURN', turn: pd.current_turn });
        } catch { /* ignore */ }
      }

      return data;
    } catch (err) {
      toast.error((err as Error)?.message ?? 'Failed to pick up card.');
      return null;
    } finally {
      pickingUpRef.current = false;
    }
  }, [isMyTurn, room.id, toast, userId]);

  const canPlayCard = useCallback(
    (card: string) =>
      isMyTurn &&
      !showDrawnPlayOption &&
      !isPlacementLocked &&
      !isBotActionPending &&
      !turnExpiredRef.current &&
      turnTimeLeft > 0 &&
      isValidPlay(card, gameRef.current.topCard),
    [isMyTurn, turnTimeLeft, isPlacementLocked, isBotActionPending, showDrawnPlayOption],
  );

  const onPlay = useCallback(
    (card: string) => {
      if (showDrawnPlayOption && drawnCards[0] !== card) return;
      if (!canPlayCard(card)) return;
      playCard(card);
    },
    [canPlayCard, playCard, showDrawnPlayOption, drawnCards],
  );

  const onPickup = useCallback(() => {
    if (
      !isMyTurn ||
      turnExpiredRef.current ||
      turnTimeLeft <= 0 ||
      isPlacementLocked ||
      isBotActionPending ||
      showDrawnPlayOption
    ) return;
    pickupCard();
  }, [isMyTurn, pickupCard, turnTimeLeft, isPlacementLocked, isBotActionPending, showDrawnPlayOption]);

  const handleTurnExpiry = useCallback(async () => {
    try {
      const data = await pickupCard();
      if (data && data.current_turn === userId) await passTurn();
    } catch { /* ignore */ }
  }, [pickupCard, passTurn, userId]);

  useEffect(() => {
    if (isPlacementLocked || isBotActionPending || showDrawnPlayOption) return;
    if (turnTimeLeft !== 0 || !isMyTurn || game.status !== 'in_progress') return;
    if (turnExpiredRef.current || turnJustStartedRef.current) return;
    turnExpiredRef.current = true;
    toast.error('Time is up! Your turn has ended.');
    handleTurnExpiry();
  }, [turnTimeLeft, isMyTurn, game.status, handleTurnExpiry, toast, isPlacementLocked, isBotActionPending, showDrawnPlayOption]);

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

  const playAgain = useCallback(async () => {
    try { await resetGameApi(room.id); }
    catch { /* game-reset event handles state */ }
  }, [room.id]);

  // ── Echo subscription ───────────────────────────────────────────────────
  useEffect(() => {
    const typedEcho = getTypedEcho(echo);
    if (!typedEcho) return;
    const channel = typedEcho.join(`room-${room.id}`);
    if (!channel) return;

    channel.here((members: PresenceMember[]) => {
      const players = (members ?? []).map((m) => ({ id: m.id, name: m.name ?? `Player ${m.id}` }));
      setConnectedPlayers(uniqById([...(staticRoomPlayersRef.current ?? []), ...players]));
    });

    channel.joining((m: PresenceMember) => {
      setConnectedPlayers((prev) =>
        uniqById([...(prev ?? []), { id: m.id, name: m.name ?? `Player ${m.id}` }]),
      );
    });

    channel.leaving((m: PresenceMember) => {
      setConnectedPlayers((prev) => {
        const without = (prev ?? []).filter((p) => p.id !== m.id);
        const bots = (staticRoomPlayersRef.current ?? []).filter((p) => p.role === 'bot');
        return uniqById([...bots, ...without]);
      });
    });

    // Event handlers defined inside effect to safely capture stable refs/callbacks
    const onGameStarted = (raw: unknown) => {
      const data = raw as {
        hand_counts?: Record<string, number>;
        handCounts?: Record<string, number>;
        used_cards?: string[];
        usedCards?: string[];
        turn_player_id?: number;
        turnPlayerId?: number;
        deck_count?: number;
        deckCount?: number;
        players?: Array<{ id: number; name?: string; role?: string }>;
      };
      const hc = data.hand_counts ?? data.handCounts ?? {};
      const uc = data.used_cards ?? data.usedCards ?? [];
      const turn =
        typeof data.turn_player_id === 'number'
          ? data.turn_player_id
          : typeof data.turnPlayerId === 'number'
            ? data.turnPlayerId
            : null;

      dispatch({
        type: 'SERVER_SYNC',
        payload: {
          deckCount: data.deck_count ?? data.deckCount ?? 0,
          handCounts: hc,
          topCard: uc.at(-1) ?? gameRef.current.topCard,
          status: 'in_progress',
        },
      });
      dispatch({ type: 'SET_TURN', turn });

      if (Array.isArray(data.players) && data.players.length) {
        const merged = uniqById([...(staticRoomPlayersRef.current ?? []), ...data.players]);
        staticRoomPlayersRef.current = merged;
        setConnectedPlayers(merged);
      }
      setIsStartingGame(false);
    };

    const onCardPlayed = (raw: unknown) => {
      const data = raw as {
        player_id?: number;
        card?: string;
        used_cards?: string[];
        usedCards?: string[];
        hand_counts?: Record<string, number>;
        handCounts?: Record<string, number>;
        deck_count?: number;
        deckCount?: number;
        turn_player_id?: number;
        turnPlayerId?: number;
      };
      const actorId = typeof data.player_id === 'number' ? data.player_id : null;
      const playedCard = typeof data.card === 'string' ? data.card : '';
      const isBotActor =
        actorId !== null &&
        connectedPlayersRef.current.some((p) => p.id === actorId && p.role === 'bot');
      const used = data.used_cards ?? data.usedCards ?? [];
      const eventHC = data.hand_counts ?? data.handCounts;
      const eventDC =
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
        if (playedCard) beginPlacement(playedCard, isBotActor ? 900 : 720, isBotActor ? 'bot' : 'peer');
        const patch: Partial<GameState> = {};
        if (used.length) patch.topCard = used[used.length - 1];
        if (eventHC) patch.handCounts = eventHC;
        if (typeof eventDC === 'number') patch.deckCount = eventDC;
        if (Object.keys(patch).length) dispatch({ type: 'SERVER_SYNC', payload: patch });
        if (eventTurn !== null) dispatch({ type: 'SET_TURN', turn: eventTurn });
      };

      if (!isBotActor) { applyCardPlayed(); return; }

      const now = Date.now();
      const nextAt = Math.max(now, botActionAvailableAtRef.current) + 1100;
      botActionAvailableAtRef.current = nextAt;
      pendingBotActionsRef.current += 1;
      setIsBotActionPending(true);

      const timeoutId = window.setTimeout(() => {
        applyCardPlayed();
        pendingBotActionsRef.current = Math.max(0, pendingBotActionsRef.current - 1);
        if (pendingBotActionsRef.current === 0) setIsBotActionPending(false);
        botActionTimeoutsRef.current = botActionTimeoutsRef.current.filter((id) => id !== timeoutId);
      }, Math.max(0, nextAt - now));

      botActionTimeoutsRef.current.push(timeoutId);
    };

    const onHandSynced = (raw: unknown) => {
      const d = raw as {
        user_id?: number;
        userId?: number;
        hand?: string[];
        hand_counts?: Record<string, number>;
        handCounts?: Record<string, number>;
        deck_count?: number;
        deckCount?: number;
        used_cards?: string[];
        usedCards?: string[];
        turn_player_id?: number | null;
        turnPlayerId?: number | null;
      };
      if ((d.user_id ?? d.userId) !== userId) return;
      const dc =
        typeof d.deck_count === 'number'
          ? d.deck_count
          : typeof d.deckCount === 'number'
            ? d.deckCount
            : gameRef.current.deckCount;
      const turn =
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
            handCounts: (d.hand_counts ?? d.handCounts) ?? gameRef.current.handCounts,
            deckCount: dc,
            topCard: ((d.used_cards ?? d.usedCards) ?? []).at(-1) ?? gameRef.current.topCard,
          },
        });
        if (turn !== null) dispatch({ type: 'SET_TURN', turn });
      });
    };

    const onGameFinished = (raw: unknown) => {
      const d = raw as {
        winner_id?: number | null;
        winnerId?: number | null;
        hand_counts?: Record<string, number>;
        handCounts?: Record<string, number>;
      };
      const winner =
        typeof d.winner_id === 'number'
          ? d.winner_id
          : typeof d.winnerId === 'number'
            ? d.winnerId
            : null;
      dispatch({
        type: 'SERVER_SYNC',
        payload: {
          status: 'finished',
          winnerId: winner,
          handCounts: (d.hand_counts ?? d.handCounts) ?? gameRef.current.handCounts,
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
      } catch { /* ignore */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id]);

  // ── Resync on mount ─────────────────────────────────────────────────────
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
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [room.id]);

  // ── Derived values ───────────────────────────────────────────────────────
  const connectedPlayersLite = useMemo<PlayerLite[]>(
    () => uniqById(connectedPlayers).map((p) => ({ id: String(p.id), name: p.name })),
    [connectedPlayers],
  );

  const seats = useMemo(
    () => getSeats(connectedPlayersLite, String(userId)),
    [connectedPlayersLite, userId],
  );

  const isSeatTurn = useCallback(
    (pid?: string | null) => {
      if (!pid || game.currentTurn == null) return false;
      return String(game.currentTurn) === pid;
    },
    [game.currentTurn],
  );

  const leftCount  = seats.left  ? (game.handCounts[seats.left.id]  ?? 0) : 0;
  const topCount   = seats.top   ? (game.handCounts[seats.top.id]   ?? 0) : 0;
  const rightCount = seats.right ? (game.handCounts[seats.right.id] ?? 0) : 0;

  return {
    // Game state
    game,
    isMyTurn,
    // Seating
    seats,
    isSeatTurn,
    leftCount,
    topCount,
    rightCount,
    // Players
    connectedPlayers,
    connectedPlayersLite,
    // Timer
    turnTimeLeft,
    drawDecisionTimeLeft,
    turnExpiredRef,
    // Animation
    flyingCard,
    isFlying,
    isPlacementLocked,
    placingCard,
    isBotActionPending,
    // Draw interaction
    drawnCards,
    showDrawnPlayOption,
    setShowDrawnPlayOption,
    setDrawnCards,
    // UI
    isChatOpen,
    setIsChatOpen,
    isStartingGame,
    // Actions
    onPlay,
    onPickup,
    playCard,
    passTurn,
    startGame,
    leaveGame,
    playAgain,
  };
}
