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
import { playCardApi, pickupCardApi, passTurnApi, resyncStateApi, resetGameApi, startGameApi } from '@/utils/api';
import { getTypedEcho } from '@/types/echo';
import { getSeats } from '@/utils/getSeats';

// ── Public types ────────────────────────────────────────────────────────────
export type Player = { id: number; name?: string; role?: string; avatar_url?: string | null };
export type PlayerLite = { id: string; name?: string; avatar_url?: string | null };

export type GameState = {
  hand: string[];
  deckCount: number;
  topCard: string | null;
  handCounts: Record<string, number>;
  currentTurn: number | null;
  status: 'waiting' | 'in_progress' | 'paused' | 'finished';
  winnerId: number | null | undefined;
  pickupPenalty: number;
  pausedBy?: string | null;
};

export type FlyingCard = { card: string; from: 'bottom' | 'top' | 'left' | 'right' };

// ── Internal types ──────────────────────────────────────────────────────────
type Action =
  | { type: 'SERVER_SYNC'; payload: Partial<GameState> }
  | { type: 'SET_TURN'; turn: number | null };

type PresenceMember = { id: number; name?: string; avatar_url?: string | null };

export type GameEngineInput = {
  room: {
    id: number;
    rules: { turn_timeout_seconds?: number; rules?: string[] };
    players?: Player[];
  };
  userId: number;
  initialHand: string[];
  initialDeckCount: number;
  initialUsedCards: string[];
  initialHandCounts: Record<string, number>;
  initialGameStatus: 'waiting' | 'in_progress' | 'paused' | 'finished';
  initialCurrentTurn: number | null;
  initialTurnStartedAt: string | null;
  initialWinnerId: number | null | undefined;
  initialPickupPenalty: number;
  toast: { error: (msg: string) => void };
};

// Palīgfunkcijas
// gameReducer — atjaunina spēles stāvokli pēc dispatch
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

const removeOneCard = (cards: string[], card: string): string[] => {
  const idx = cards.lastIndexOf(card);
  if (idx === -1) return cards;
  return [...cards.slice(0, idx), ...cards.slice(idx + 1)];
};

// Galvenais hooks — visa spēles loģika ir šeit
export function useGameEngine({
  room,
  userId,
  initialHand,
  initialDeckCount,
  initialUsedCards,
  initialHandCounts,
  initialGameStatus,
  initialCurrentTurn,
  initialTurnStartedAt,
  initialWinnerId,
  initialPickupPenalty,
  toast,
}: GameEngineInput) {
  const uid = String(userId);
  const turnTimeoutSeconds = room.rules.turn_timeout_seconds ?? 5;
  const stackingActive  = Array.isArray(room.rules.rules) && room.rules.rules.includes('stacking');
  const plusTwoActive   = Array.isArray(room.rules.rules) && room.rules.rules.includes('plus_two');

  // Aprēķina cik laika palicis no gājiena sākuma (ko uzreiz atgriež serveris)
  const computeRemaining = (turnStartedAt: string | null) => {
    if (!turnStartedAt) return null;
    const elapsed = Math.floor((Date.now() - new Date(turnStartedAt).getTime()) / 1000);
    return Math.max(0, turnTimeoutSeconds - elapsed);
  };

  // ── Game state ──────────────────────────────────────────────────────────
  const [game, dispatch] = useReducer(gameReducer, {
    hand: initialHand,
    deckCount: initialDeckCount,
    topCard: initialUsedCards.at(-1) ?? null,
    handCounts: initialHandCounts,
    currentTurn: initialCurrentTurn,
    status: initialGameStatus,
    winnerId: initialWinnerId,
    pickupPenalty: initialPickupPenalty,
  });

  // Animāciju un UI stāvoklis
  const [turnTimeLeft, setTurnTimeLeft] = useState(() => computeRemaining(initialTurnStartedAt) ?? turnTimeoutSeconds);
  const [placingCard, setPlacingCard] = useState<string | null>(null);
  const [isPlacementLocked, setIsPlacementLocked] = useState(false);
  const [isBotActionPending, setIsBotActionPending] = useState(false);
  const [drawnCards, setDrawnCards] = useState<string[]>([]);
  const [showDrawnPlayOption, setShowDrawnPlayOption] = useState(false);
  const [drawDecisionTimeLeft, setDrawDecisionTimeLeft] = useState(5);
  const [flyingCard, setFlyingCard] = useState<FlyingCard | null>(null);
  const [isFlying, setIsFlying] = useState(false);
  const [isPickingUp, setIsPickingUp] = useState(false);
  const [pickingUpCount, setPickingUpCount] = useState(0);
  const [peerPickupAnims, setPeerPickupAnims] = useState<Array<{ id: number; direction: FlyingCard['from']; count: number }>>([]);
  const [connectedPlayers, setConnectedPlayers] = useState<Player[]>(room.players ?? []);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isStartingGame, setIsStartingGame] = useState(false);

  // Refs — vērtības kas jāpiekļūst no callbacks bez re-render
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
  const pickupAnimEndRef = useRef(0);
  const suppressDecisionRef = useRef(false);
  const lastSnapshotRef = useRef<GameState | null>(null);
  // Ļauj override taimeri pēc resync — izmantots vienreiz, tad notīrīts
  const turnTimeOverrideRef = useRef<number | null>(computeRemaining(initialTurnStartedAt));

  useEffect(() => { gameRef.current = game; }, [game]);
  useEffect(() => { connectedPlayersRef.current = connectedPlayers; }, [connectedPlayers]);
  useEffect(() => {
    staticRoomPlayersRef.current = room.players ?? [];
    connectedPlayersRef.current = room.players ?? [];
    setConnectedPlayers(room.players ?? []);
  }, [room.players]);

  // Kārts likšanas animācija uz galda
  const clearPlacementTimeout = useCallback(() => {
    if (placementTimeoutRef.current !== null) {
      window.clearTimeout(placementTimeoutRef.current);
      placementTimeoutRef.current = null;
    }
  }, []);

  const beginPlacement = useCallback(
    (card: string | null, durationMs = 700, from: FlyingCard['from'] = 'top') => {
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

  // Notīra timeouts kad komponents tiek noņemts
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

  // Atpakaļskaitīšana gājienam — restartē katru reizi kad mainās kārta
  useEffect(() => {
    // Ja ir override no resync, izmantojam to vienreiz, citādi sākam no sākuma
    const override = turnTimeOverrideRef.current;
    turnTimeOverrideRef.current = null;
    setTurnTimeLeft(override ?? turnTimeoutSeconds);
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
      showDrawnPlayOption ||
      isPickingUp
    ) return;
    const timer = window.setInterval(() => setTurnTimeLeft((c) => Math.max(c - 1, 0)), 1000);
    return () => window.clearInterval(timer);
  }, [game.currentTurn, game.status, isPlacementLocked, isBotActionPending, showDrawnPlayOption, isPickingUp]);

  // Atpakaļskaitīšana pacelšanas lēmumam — cik ilgi var izlemt likt vai nolikt
  useEffect(() => {
    if (!showDrawnPlayOption) return;
      setDrawDecisionTimeLeft(5);
    const timer = window.setInterval(() => setDrawDecisionTimeLeft((c) => Math.max(c - 1, 0)), 1000);
    return () => window.clearInterval(timer);
  }, [showDrawnPlayOption]);

  useEffect(() => {
    if (!showDrawnPlayOption || drawDecisionTimeLeft > 0) return;
    const card = drawnCards[0];
    setShowDrawnPlayOption(false);
    setDrawnCards([]);
    if (card) {
      startTransition(() => {
        dispatch({
          type: 'SERVER_SYNC',
          payload: {
            hand: [...gameRef.current.hand, card],
            handCounts: {
              ...gameRef.current.handCounts,
              [uid]: (gameRef.current.handCounts[uid] ?? gameRef.current.hand.length) + 1,
            },
          },
        });
      });
    }
    if (game.currentTurn === userId) {
      passTurnApi(room.id)
        .then((d) => {
          if (typeof d.current_turn === 'number') dispatch({ type: 'SET_TURN', turn: d.current_turn });
        })
        .catch(() => toast.error('Unable to keep drawn card automatically.'));
    }
  }, [drawDecisionTimeLeft, drawnCards, game.currentTurn, room.id, showDrawnPlayOption, toast, uid, userId]);

  const isMyTurn = useMemo(() => game.currentTurn === userId, [game.currentTurn, userId]);

  // Dismiss draw option when turn changes away
  useEffect(() => {
    if (!showDrawnPlayOption || isMyTurn) return;
    setShowDrawnPlayOption(false);
    setDrawnCards([]);
  }, [isMyTurn, showDrawnPlayOption]);

  const keepDrawnCard = useCallback(() => {
    const card = drawnCards[0];
    setShowDrawnPlayOption(false);
    setDrawnCards([]);
    if (!card) return;
    startTransition(() => {
      dispatch({
        type: 'SERVER_SYNC',
        payload: {
          hand: [...gameRef.current.hand, card],
          handCounts: {
            ...gameRef.current.handCounts,
            [uid]: (gameRef.current.handCounts[uid] ?? gameRef.current.hand.length) + 1,
          },
        },
      });
    });
  }, [drawnCards, uid]);

  // Darbības — spēlētāja iespējamie gājieni
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

      // Optimistiski atjauno spēles stāvokli lokāli (pirms servera apstiprināšana)
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
        beginPlacement(card, 720, 'bottom');
        await playCardApi(room.id, card);
      } catch (err) {
        // Ja serveris nereagē, atjauno iepriekšējo spēles stāvokli
        if (lastSnapshotRef.current) dispatch({ type: 'SERVER_SYNC', payload: lastSnapshotRef.current });
        toast.error((err as Error)?.message ?? 'Failed to play card.');
      }
    },
    [isMyTurn, room.id, uid, toast, beginPlacement],
  );

  const pickupCard = useCallback(async (suppressDecision = false) => {
    if (!isMyTurn || pickingUpRef.current) return null;
    pickingUpRef.current = true;
    suppressDecisionRef.current = suppressDecision;
    const penaltyCount = Math.min(Math.max(gameRef.current.pickupPenalty, 1), 5);
    setIsPickingUp(true);
    setPickingUpCount(penaltyCount);
    try {
      const prevHand = [...gameRef.current.hand];
      const data = await pickupCardApi(room.id);
      const syncedHand: string[] = data.hand ?? gameRef.current.hand;
      const added = getAddedCards(prevHand, syncedHand);
      const topAfter = (data.used_cards ?? []).at(-1) ?? gameRef.current.topCard;
      const playableDrawn = added.filter((c: string) => isValidPlay(c, topAfter));
      const nextTurn =
        typeof data.current_turn === 'number'
          ? data.current_turn
          : gameRef.current.currentTurn;
      const shouldOfferDrawn =
        playableDrawn.length > 0 &&
        nextTurn === userId &&
        !suppressDecisionRef.current;
      const decisionCard = shouldOfferDrawn ? playableDrawn[playableDrawn.length - 1] : null;
      const visibleAdded = decisionCard ? removeOneCard(added, decisionCard) : added;

      // Use server-reported count for animation
      const animCount = Math.min(Math.max(data.drawn_count ?? penaltyCount, 1), 52);
      setPickingUpCount(animCount);

      startTransition(() => {
        dispatch({
          type: 'SERVER_SYNC',
          payload: {
            deckCount: typeof data.deck_count === 'number' ? data.deck_count : gameRef.current.deckCount,
            topCard: topAfter,
          },
        });
        if (typeof data.current_turn === 'number') dispatch({ type: 'SET_TURN', turn: data.current_turn });
      });

      // Deck was truly empty — skip animation and pass turn immediately
      if (data.drawn_count === 0) {
        setIsPickingUp(false);
        setPickingUpCount(0);
        pickingUpRef.current = false;
        suppressDecisionRef.current = false;
        // Also sync the hand immediately in the empty-deck case
        startTransition(() => {
          dispatch({
            type: 'SERVER_SYNC',
            payload: {
              hand: data.hand ?? gameRef.current.hand,
              handCounts: data.hand_counts ?? gameRef.current.handCounts,
            },
          });
        });
        if (nextTurn === userId) {
          passTurnApi(room.id)
            .then((d) => { if (typeof d.current_turn === 'number') dispatch({ type: 'SET_TURN', turn: d.current_turn }); })
            .catch(() => {});
        }
        return data;
      }

      // Match CSS timing: 480ms duration, 150ms stagger
      const clearDelay = (animCount - 1) * 150 + 480 + 200;
      pickupAnimEndRef.current = Date.now() + clearDelay + 100;

      // Cards land in hand one-by-one as each card-back animation finishes
      const snapshot = [...prevHand];
      const cardsToAnimate = Math.min(animCount, visibleAdded.length);
      for (let i = 0; i < cardsToAnimate; i++) {
        window.setTimeout(() => {
          startTransition(() => {
            dispatch({
              type: 'SERVER_SYNC',
              payload: { hand: [...snapshot, ...visibleAdded.slice(0, i + 1)] },
            });
          });
        }, i * 150 + 480 + 50);
      }

      window.setTimeout(() => {
        // Final sync: ensure hand + counts match server state exactly
        const serverHand = data.hand ?? gameRef.current.hand;
        const handForDecision = decisionCard ? removeOneCard(serverHand, decisionCard) : serverHand;
        startTransition(() => {
          dispatch({
            type: 'SERVER_SYNC',
            payload: {
              hand: handForDecision,
              handCounts: data.hand_counts ?? gameRef.current.handCounts,
            },
          });
        });
        setIsPickingUp(false);
        setPickingUpCount(0);
        pickingUpRef.current = false;
        // Show the playable card AFTER all card-back animations have landed
        if (decisionCard) {
          setDrawnCards([decisionCard]);
          setShowDrawnPlayOption(true);
          turnExpiredRef.current = false;
          setTurnTimeLeft((c) => Math.max(c, 5));
        } else if (suppressDecisionRef.current && nextTurn === userId) {
          // Timer expired with a playable drawn card — auto-pass
          passTurnApi(room.id)
            .then((d) => { if (typeof d.current_turn === 'number') dispatch({ type: 'SET_TURN', turn: d.current_turn }); })
            .catch(() => {});
        }
        suppressDecisionRef.current = false;
      }, clearDelay);

      return data;
    } catch (err) {
      setIsPickingUp(false);
      setPickingUpCount(0);
      pickingUpRef.current = false;
      suppressDecisionRef.current = false;
      toast.error((err as Error)?.message ?? 'Failed to pick up card.');
      return null;
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
      isValidPlay(card, gameRef.current.topCard, gameRef.current.pickupPenalty, stackingActive),
    [isMyTurn, turnTimeLeft, isPlacementLocked, isBotActionPending, showDrawnPlayOption, stackingActive],
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

  // Auto-pacelšana ja ir +2 sods un spēlētājs nevar likt 2 virsū
  const autoPickedUpRef = useRef(false);
  useEffect(() => {
    if (!isMyTurn || !plusTwoActive || game.pickupPenalty <= 0) {
      autoPickedUpRef.current = false;
      return;
    }
    if (isPlacementLocked || isBotActionPending || pickingUpRef.current) return;
    if (autoPickedUpRef.current) return;

    // Spēlētājs var "stackot" tikai ja ir stacking noteikums UN ir 2 rokā
    const canStack =
      stackingActive && game.hand.some((c) => c.startsWith('2-'));

    if (!canStack) {
      autoPickedUpRef.current = true;
      pickupCard();
    }
  }, [isMyTurn, plusTwoActive, stackingActive, game.pickupPenalty, game.hand, isPlacementLocked, isBotActionPending, pickupCard]);

  const handleTurnExpiry = useCallback(async () => {
    try {
      // suppressDecision=true lai automātiski pielaiž gājienu, nevis rāda izvēlni
      await pickupCard(true);
    } catch { /* ignore */ }
  }, [pickupCard]);

  useEffect(() => {
    if (isPlacementLocked || isBotActionPending || showDrawnPlayOption || isPickingUp) return;
    if (turnTimeLeft !== 0 || !isMyTurn || game.status !== 'in_progress') return;
    if (turnExpiredRef.current || turnJustStartedRef.current) return;
    turnExpiredRef.current = true;
    toast.error('Time is up! Your turn has ended.');
    handleTurnExpiry();
  }, [turnTimeLeft, isMyTurn, game.status, handleTurnExpiry, toast, isPlacementLocked, isBotActionPending, showDrawnPlayOption, isPickingUp]);

  const startGame = useCallback(async () => {
    if (isStartingGame) return;
    setIsStartingGame(true);
    try {
      await startGameApi(room.id);
      // Radītājs tiek izslēgts no broadcast (X-Socket-Id), tāpēc resync manuāli
      const data = await resyncStateApi(room.id);
      // Ja tika pievienoti boti, ielādē atjaunināto spēlētāju sarakstu
      if (Array.isArray(data.players) && data.players.length) {
        const merged = uniqById([...(staticRoomPlayersRef.current ?? []), ...data.players]);
        staticRoomPlayersRef.current = merged;
        setConnectedPlayers(merged);
      }
      startTransition(() => {
        dispatch({
          type: 'SERVER_SYNC',
          payload: {
            hand: data.hand ?? gameRef.current.hand,
            handCounts: data.hand_counts ?? gameRef.current.handCounts,
            deckCount: typeof data.deck_count === 'number' ? data.deck_count : gameRef.current.deckCount,
            topCard: (data.used_cards ?? []).at(-1) ?? gameRef.current.topCard,
            status: data.game_status ?? gameRef.current.status,
            pickupPenalty: typeof data.pickup_penalty === 'number' ? data.pickup_penalty : gameRef.current.pickupPenalty,
          },
        });
        dispatch({ type: 'SET_TURN', turn: data.current_turn ?? null });
      });
    } catch (err) {
      toast.error((err as Error)?.message ?? 'Failed to start game.');
    } finally {
      setIsStartingGame(false);
    }
  }, [isStartingGame, room.id, toast]);

  const leaveGame = useCallback(() => {
    router.delete(`/leaveroom/${room.id}`);
  }, [room.id]);

  const playAgain = useCallback(async () => {
    try { await resetGameApi(room.id); }
    catch { /* game-reset event handles state */ }
  }, [room.id]);

  // Reāllaika notikumi caur Echo/Pusher — klausās uz istabas kanāla
  useEffect(() => {
    const typedEcho = getTypedEcho(echo);
    if (!typedEcho) return;
    const channel = typedEcho.join(`room-${room.id}`);
    if (!channel) return;

    channel.here((members: PresenceMember[]) => {
      const players = (members ?? []).map((m) => ({ id: m.id, name: m.name ?? `Player ${m.id}`, avatar_url: m.avatar_url ?? null }));
      setConnectedPlayers(uniqById([...(staticRoomPlayersRef.current ?? []), ...players]));
    });

    channel.joining((m: PresenceMember) => {
      setConnectedPlayers((prev) =>
        uniqById([...(prev ?? []), { id: m.id, name: m.name ?? `Player ${m.id}`, avatar_url: m.avatar_url ?? null }]),
      );
    });

    channel.leaving((m: PresenceMember) => {
      setConnectedPlayers((prev) => {
        const without = (prev ?? []).filter((p) => p.id !== m.id);
        const bots = (staticRoomPlayersRef.current ?? []).filter((p) => p.role === 'bot');
        return uniqById([...bots, ...without]);
      });
    });

    // Notikumu apstrādātāji — šeit definēti lai var izmantot refs
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
        pickup_penalty?: number;
      };
      const actorId = typeof data.player_id === 'number' ? data.player_id : null;
      const playedCard = typeof data.card === 'string' ? data.card : '';
      const isBotActor =
        actorId !== null &&
        connectedPlayersRef.current.some((p) => p.id === actorId && p.role === 'bot');

      // No kuras puses nāk lidojošā kārts animācija
      const getActorFrom = (id: number | null): FlyingCard['from'] => {
        if (id === userId) return 'bottom';
        if (id === null) return 'top';
        const liteId = String(id);
        const lite = uniqById(connectedPlayersRef.current).map((p) => ({ id: String(p.id), name: p.name }));
        const s = getSeats(lite, uid);
        if (s.left?.id === liteId) return 'left';
        if (s.right?.id === liteId) return 'right';
        return 'top';
      };
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
        if (playedCard) beginPlacement(playedCard, isBotActor ? 900 : 720, getActorFrom(actorId));
        const patch: Partial<GameState> = {};
        if (used.length) patch.topCard = used[used.length - 1];
        if (eventHC) patch.handCounts = eventHC;
        if (typeof eventDC === 'number') patch.deckCount = eventDC;
        if (typeof data.pickup_penalty === 'number') patch.pickupPenalty = data.pickup_penalty;
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
        pickup_penalty?: number;
      };
      const actorId = d.user_id ?? d.userId;

      if (actorId !== userId) {
        // Cits spēlētājs paņēma kārtis — atjaunam skaitus un rādam animāciju
        const newHC = d.hand_counts ?? d.handCounts;
        if (newHC) {
          const actorStr = String(actorId);
          const prevCount = gameRef.current.handCounts[actorStr] ?? 0;
          const delta = Math.max(0, (newHC[actorStr] ?? 0) - prevCount);
          if (delta > 0) {
            const liteList = uniqById(connectedPlayersRef.current).map((p) => ({ id: String(p.id), name: p.name }));
            const s = getSeats(liteList, uid);
            let direction: FlyingCard['from'] = 'top';
            if (actorStr === s.left?.id) direction = 'left';
            else if (actorStr === s.right?.id) direction = 'right';
            const animId = Date.now() + Math.random();
            setPeerPickupAnims((prev) => [...prev, { id: animId, direction, count: Math.min(delta, 5) }]);
            window.setTimeout(() => {
              setPeerPickupAnims((prev) => prev.filter((a) => a.id !== animId));
            }, (Math.min(delta, 5) - 1) * 150 + 480 + 300);
          }
          const dc = typeof d.deck_count === 'number' ? d.deck_count
            : typeof d.deckCount === 'number' ? d.deckCount : undefined;
          const patch: Partial<GameState> = { handCounts: newHC };
          if (typeof dc === 'number') patch.deckCount = dc;
          if (typeof d.pickup_penalty === 'number') patch.pickupPenalty = d.pickup_penalty;
          dispatch({ type: 'SERVER_SYNC', payload: patch });
        }
        // Obligāti sinhronizē gājienu — citādi nākamais spēlētājs nezin ka ir viņa kārta
        const peerTurn =
          typeof d.turn_player_id === 'number'
            ? d.turn_player_id
            : typeof d.turnPlayerId === 'number'
              ? d.turnPlayerId
              : null;
        if (peerTurn !== null) dispatch({ type: 'SET_TURN', turn: peerTurn });
        return;
      }

      // Paša sinhronizāciju ignorēm kamēr rit pacelšanas animācija — pickupCard() to pats kontrolē
      if (pickingUpRef.current) return;

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
            pickupPenalty: typeof d.pickup_penalty === 'number' ? d.pickup_penalty : gameRef.current.pickupPenalty,
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

      const applyFinish = () => {
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

      // Gaidam kamēr visi boti un animācijas beidz, tikai tad rādam uzvaras ekrānu
      const botWait = botActionAvailableAtRef.current - Date.now();
      const botRemaining = pendingBotActionsRef.current > 0
        ? Math.max(botWait + 900, 900)   // pending bot delay + placement animation
        : Math.max(0, botWait);
      const remaining = Math.max(
        botRemaining,
        placementTimeoutRef.current !== null ? 900 : 0,
        pickupAnimEndRef.current - Date.now(),
      );
      if (remaining > 0) {
        window.setTimeout(applyFinish, remaining + 200);
      } else {
        applyFinish();
      }
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
          pickupPenalty: 0,
          pausedBy: null,
        },
      });
      // Reloadojam istabas datus lai noņemtie boti pazūd no saraksta
      router.reload({ only: ['room'] });
    };

    const onGamePaused = (raw: unknown) => {
      const d = raw as { leaver_name?: string };
      dispatch({
        type: 'SERVER_SYNC',
        payload: { status: 'paused', pausedBy: d.leaver_name ?? null },
      });
    };

    const onGameResumed = (raw: unknown) => {
      const d = raw as {
        hand_counts?: Record<string, number>;
        deck_count?: number;
        used_cards?: string[];
        current_turn?: number | null;
        players?: Array<{ id: number; name?: string; role?: string }>;
      };
      if (Array.isArray(d.players) && d.players.length) {
        const merged = uniqById([...(staticRoomPlayersRef.current ?? []), ...d.players]);
        staticRoomPlayersRef.current = merged;
        setConnectedPlayers(merged);
      }
      dispatch({
        type: 'SERVER_SYNC',
        payload: {
          status: 'in_progress',
          pausedBy: null,
          handCounts: d.hand_counts ?? gameRef.current.handCounts,
          deckCount: typeof d.deck_count === 'number' ? d.deck_count : gameRef.current.deckCount,
          topCard: (d.used_cards ?? []).at(-1) ?? gameRef.current.topCard,
        },
      });
      if (typeof d.current_turn === 'number') dispatch({ type: 'SET_TURN', turn: d.current_turn });
    };

    channel.listen('.game-started', onGameStarted);
    channel.listen('.card-played', onCardPlayed);
    channel.listen('.hand-synced', onHandSynced);
    channel.listen('.game-finished', onGameFinished);
    channel.listen('.game-reset', onGameReset);
    channel.listen('.game-paused', onGamePaused);
    channel.listen('.game-resumed', onGameResumed);

    return () => {
      try {
        channel.stopListening('.game-started');
        channel.stopListening('.card-played');
        channel.stopListening('.hand-synced');
        channel.stopListening('.game-finished');
        channel.stopListening('.game-reset');
        channel.stopListening('.game-paused');
        channel.stopListening('.game-resumed');
        typedEcho.leave(`room-${room.id}`);
      } catch { /* ignore */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id]);

  // Sinhronizācija pie lapas ielādes — ielādē aktuālo stāvokli no servera
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await resyncStateApi(room.id);
        if (cancelled) return;
        // Saglabājam atlikušo laiku pirms SET_TURN lai taimeris pareizi atsākas
        if (data.turn_started_at && data.current_turn != null) {
          const remaining = computeRemaining(data.turn_started_at);
          if (remaining !== null) {
            turnTimeOverrideRef.current = remaining;
            // Arī tieši iestatām gadījumā ja SET_TURN effect neizpildās
            window.setTimeout(() => setTurnTimeLeft(remaining), 0);
          }
        }
        // Atjaunam spēlētāju sarakstu — boti var būt pievienoti pēc lapas ielādes
        if (Array.isArray(data.players) && data.players.length) {
          const merged = uniqById([...(staticRoomPlayersRef.current ?? []), ...data.players]);
          staticRoomPlayersRef.current = merged;
          setConnectedPlayers(merged);
        }
        dispatch({
          type: 'SERVER_SYNC',
          payload: {
            hand: data.hand ?? gameRef.current.hand,
            handCounts: data.hand_counts ?? gameRef.current.handCounts,
            deckCount: typeof data.deck_count === 'number' ? data.deck_count : gameRef.current.deckCount,
            topCard: (data.used_cards ?? []).at(-1) ?? gameRef.current.topCard,
            status: data.game_status ?? gameRef.current.status,
            pickupPenalty: typeof data.pickup_penalty === 'number' ? data.pickup_penalty : gameRef.current.pickupPenalty,
          },
        });
        dispatch({ type: 'SET_TURN', turn: data.current_turn ?? null });
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [room.id]);

  // Atvasinātās vērtības — aprēķinātas no stāvokļa, netiek saglabātas atsevišķi
  const connectedPlayersLite = useMemo<PlayerLite[]>(
    () => uniqById(connectedPlayers).map((p) => ({ id: String(p.id), name: p.name, avatar_url: p.avatar_url })),
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
    isPickingUp,
    pickingUpCount,
    peerPickupAnims,
    // Draw interaction
    drawnCards,
    showDrawnPlayOption,
    keepDrawnCard,
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
