import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import RoomChat from '@/components/RoomChat';
import { MessageCircle } from 'lucide-react';
import echo from '@/lib/echo';

type Props = {
  room: {
    id: number;
    code: string;
    rules: string[];
    // On initial load you may provide only my hand here (not others')
    player_hands?: Record<string, string[]>;
    used_cards?: string[];
    game_status?: 'waiting' | 'in_progress' | 'finished';
    players?: any[]; // initial people from SSR if you pass them
  };
  deck: string[]; // initial server deck for SSR; we only use its length as deckCount seed
  userId: number;
};

type PresencePayload = {
  hand_counts: Record<string, number>;
  used_cards: string[];
  deck_count: number;
  turn_player_id: number;
};

type HandSyncedPayload = {
  hand: string[];
};

function Board(_initialProps: Props) {
  const { props } = usePage<Props>();
  const { room, deck, userId } = props;

  const uid = String(userId);
  const roomChannelName = `room-${room.id}`;
  const userChannelName = `user-${userId}`;

  const [isChatOpen, setIsChatOpen] = useState(false);

  const [hand, setHand] = useState<string[]>(room.player_hands?.[uid] ?? []);

  // We no longer keep an entire deck client-side; just the count
  const [deckCount, setDeckCount] = useState<number>(deck?.length ?? 0);

  const initialTopCard = room.used_cards?.length ? room.used_cards.at(-1)! : null;
  const [topCard, setTopCard] = useState<string | null>(initialTopCard);

  const [gameStatus, setGameStatus] = useState<'waiting' | 'in_progress' | 'finished'>(room.game_status ?? 'waiting');

  const [isStartingGame, setIsStartingGame] = useState(false);

  const [connectedPlayers, setConnectedPlayers] = useState<any[]>([]);
  const [handCounts, setHandCounts] = useState<Record<string, number>>({});
  const [currentTurn, setCurrentTurn] = useState<number | null>(null);

  const hasLeftRef = useRef(false);
  const startGameResetTimer = useRef<number | null>(null);

  const isMyTurn = useMemo(() => currentTurn === userId, [currentTurn, userId]);

  useEffect(() => {
    const off = router.on('before', (event) => {
      const id = (echo as any)?.socketId?.();
      if (id) event.detail.visit.headers['X-Socket-Id'] = id;
    });
    return () => off();
  }, []);

  useEffect(() => {
    setHand(room.player_hands?.[uid] ?? []);
    setDeckCount(deck?.length ?? 0);
    setTopCard(room.used_cards?.length ? room.used_cards.at(-1)! : null);
    setGameStatus(room.game_status ?? 'waiting');
  }, [room.player_hands, room.used_cards, room.game_status, deck, uid]);

  useEffect(() => {
    if (!echo) return;

    const channel = echo.join(roomChannelName);

    // Initial presence roster
    channel.here((members: any[]) => {
      setConnectedPlayers(uniqById(members));
    });

    channel.joining((member: any) => {
      setConnectedPlayers(prev => uniqById([...prev, member]));
    });

    channel.leaving((member: any) => {
      setConnectedPlayers(prev => {
        const id = member.id ?? member.user_id ?? member;
        return prev.filter(p => (p.id ?? p.user_id ?? p) !== id);
      });
    });

    channel.listen('.game-started', (data: PresencePayload) => {
      setGameStatus('in_progress');
      setIsStartingGame(false);

      if (Array.isArray(data.used_cards) && data.used_cards.length) {
        setTopCard(data.used_cards.at(-1)!);
      } else {
        setTopCard(null);
      }

      if (data.hand_counts) setHandCounts({ ...data.hand_counts });
      if (Number.isInteger(data.deck_count)) setDeckCount(data.deck_count);
      if (Number.isInteger(data.turn_player_id)) setCurrentTurn(data.turn_player_id);
    });

    channel.listen('.card-played', (data: PresencePayload & { card?: string | null }) => {
    // top card: last card in used_cards or null fallback
    const nextTop = Array.isArray(data.used_cards) && data.used_cards.length
        ? data.used_cards.at(-1)!
        : null;

    setTopCard(prev => prev === nextTop ? prev : nextTop);

    if (data.hand_counts) setHandCounts({ ...data.hand_counts });
    if (Number.isInteger(data.deck_count)) setDeckCount(data.deck_count);
    if (Number.isInteger(data.turn_player_id)) setCurrentTurn(data.turn_player_id);
    });

    return () => {
      echo.leave(roomChannelName);
    };
  }, [roomChannelName]);

  useEffect(() => {
    if (!echo) return;

    const privateChannel = echo.private(userChannelName);

    privateChannel.listen('.hand-synced', (data: HandSyncedPayload) => {
      setHand(Array.isArray(data.hand) ? [...data.hand] : []);
    });

    return () => {
      echo.leave(userChannelName);
      echo.leave(`private-${userChannelName}`);
    };
  }, [userChannelName]);

  useEffect(() => {
    const token = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';

    const leaveOnce = () => {
      if (hasLeftRef.current) return;
      hasLeftRef.current = true;

      const fd = new FormData();
      fd.append('_method', 'DELETE');
      if (token) fd.append('_token', token);

      const socketId = (echo as any)?.socketId?.() ?? '';
      const ok = navigator.sendBeacon(`/leaveroom/${room.id}`, fd);

      if (!ok) {
        fetch(`/leaveroom/${room.id}`, {
          method: 'POST',
          headers: { 'X-CSRF-TOKEN': token, 'X-Socket-Id': socketId },
          body: new URLSearchParams({ _method: 'DELETE' }),
          keepalive: true,
        }).catch(() => {});
      }
    };

    const onPageHide = () => {
      if (document.visibilityState === 'hidden') leaveOnce();
    };

    window.addEventListener('pagehide', onPageHide);

    return () => {
      leaveOnce();
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [room.id]);

  // stable parser for "VALUE-SUIT" (e.g. "10-♣")
  const parse = useCallback((code: string): [string, string] => {
    const [v, s] = code.split('-', 2);
    return [v ?? '', s ?? ''];
  }, []);

  const isValidPlay = useCallback((card: string, top: string | null): boolean => {
    if (!top) return true;
    const [cv, cs] = parse(card);
    const [tv, ts] = parse(top);
    return cv === tv || cs === ts;
  }, [parse]);

  const startGame = useCallback(() => {
    if (isStartingGame) return;

    setIsStartingGame(true);

    router.post(
      `/board/${room.id}/start-game`,
      {},
      {
        preserveState: true,
        headers: { 'X-Socket-Id': (echo as any)?.socketId?.() ?? '' },
        onError: (errors) => {
          setIsStartingGame(false);
          alert('Failed to start game: ' + (errors?.message || 'Unknown error'));
        },
        onFinish: () => {
          if (startGameResetTimer.current) window.clearTimeout(startGameResetTimer.current);
          startGameResetTimer.current = window.setTimeout(() => setIsStartingGame(false), 2500);
        },
      }
    );
  }, [isStartingGame, room.id]);

  useEffect(() => {
    return () => {
      if (startGameResetTimer.current) window.clearTimeout(startGameResetTimer.current);
    };
  }, []);

  const playCard = useCallback(async (card: string) => {
    if (!isMyTurn) return;
    if (!isValidPlay(card, topCard)) return;

    const prevHand = hand;
    const prevTop  = topCard;

    setHand(prev => prev.filter(c => c !== card));
    setTopCard(card);

    const abort = new AbortController();
    try {
      const response = await fetch(`/board/${room.id}/play-card`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
          'X-Socket-Id': (echo as any)?.socketId?.() ?? '',
        },
        body: JSON.stringify({ card }),
        signal: abort.signal,
        keepalive: true,
      });

      if (!response.ok) {
        let errorMessage = `Error ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {}
        throw new Error(errorMessage);
      }
    } catch (error) {
      // rollback
      setHand(prevHand);
      setTopCard(prevTop);
      const errorMessage = error instanceof Error ? error.message : 'Invalid move! You can’t play that card.';
      alert(errorMessage);
    }
    // no cleanup returned here (function not a hook)
  }, [hand, topCard, room.id, isValidPlay, isMyTurn]);

    const pickup = useCallback(async () => {
    if (!isMyTurn) return;

    try {
        await fetch(`/board/${room.id}/pickup`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
            'X-Socket-Id': (echo as any)?.socketId?.() ?? '',
        },
        keepalive: true,
        });
    } catch (err) {
        console.error('Failed to pick up card:', err);
    }
    }, [room.id, isMyTurn]);

  const leaveGame = useCallback(() => {
    hasLeftRef.current = false;
    router.delete(`/leaveroom/${room.id}`, {
      preserveState: true,
      headers: { 'X-Socket-Id': (echo as any)?.socketId?.() ?? '' },
      onFinish: () => { hasLeftRef.current = true; },
    });
  }, [room.id]);

  // Helper: unique members by id/user_id
  function uniqById(arr: any[]) {
    const m = new Map<string | number, any>();
    for (const p of arr) m.set(p.id ?? p.user_id ?? p, p);
    return Array.from(m.values());
  }
    useEffect(() => {
        const fetchState = async () => {
            try {
                const res = await fetch(`/board/${room.id}/resync-state`, {
                    headers: {
                        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                        'X-Socket-Id': (echo as any)?.socketId?.() ?? '',
                    },
                });

                if (!res.ok) throw new Error('Failed to resync');

                const data = await res.json();

                setHand(Array.isArray(data.hand) ? data.hand : []);
                setHandCounts(data.hand_counts ?? {});
                setDeckCount(data.deck_count ?? 0);
                setTopCard(data.used_cards?.length ? data.used_cards.at(-1)! : null);
                setCurrentTurn(data.current_turn ?? null);
                setGameStatus(data.game_status ?? 'waiting');
            } catch (err) {
                console.error('Resync failed:', err);
            }
        };

        fetchState();
    }, [room.id]);

  // ---- Render helpers
  const renderOtherPlayers = () => {
    // build a list of others + count + turn highlight
    const others = connectedPlayers.filter(p => (p.id ?? p.user_id) !== userId);

    return others.map(player => {
      const pid = String(player.id ?? player.user_id);
      const count = handCounts[pid] ?? 0;
      const isTheirTurn = currentTurn === (player.id ?? player.user_id);

      return (
        <div key={pid} className="flex flex-col items-center">
          <div className={`text-white text-sm mb-1 ${isTheirTurn ? 'font-bold' : ''}`}>
            {player.name ?? `Player ${pid}`} {isTheirTurn && <span className="ml-1 text-yellow-300 animate-pulse">(turn)</span>}
          </div>
          <div className="flex gap-1">
            {Array.from({ length: count }).map((_, i) => (
              <div
                key={i}
                className={`w-10 h-14 rounded shadow-md border
                            ${isTheirTurn ? 'bg-red-700 ring-2 ring-yellow-300' : 'bg-red-600'}`}
              />
            ))}
            {count === 0 && <div className="text-white/70 text-xs italic">no cards</div>}
          </div>
        </div>
      );
    });
  };

  return (
    <AppLayout>
      <Head title={`Board - Room ${room.code}`} />

      <div className="relative w-full h-screen bg-green-700 p-6 flex flex-col items-center justify-between">

        {/* Top Players (other players) */}
        <div className="flex justify-center gap-8 mb-4 flex-wrap">
          {renderOtherPlayers()}
        </div>

        {/* Table Center */}
        <div className="flex items-center justify-center gap-12 flex-wrap">

          {/* Remaining Deck (show count, not full deck array) */}
          <div className="relative w-20 h-28">
            <div
              className={`absolute w-full h-full rounded-lg border shadow-md flex items-center justify-center text-white text-xl cursor-pointer
                          ${isMyTurn ? 'bg-gray-800 hover:scale-105 transition-transform' : 'bg-gray-700 cursor-not-allowed opacity-70'}`}
              onClick={() => { if (isMyTurn) pickup(); }}
              aria-disabled={!isMyTurn}
              title={isMyTurn ? 'Pick up a card' : 'Wait for your turn'}
            >
              🂠
            </div>
            <p className="text-white text-center mt-2 text-sm">{deckCount} left</p>
          </div>

          {/* Top Card */}
          <div className="relative w-20 h-28">
            {topCard ? (
              <div className="absolute w-full h-full rounded-lg bg-white border shadow-lg flex items-center justify-center text-xl font-bold">
                {topCard}
              </div>
            ) : (
              <div className="absolute w-full h-full rounded-lg bg-neutral-800 border shadow-md flex items-center justify-center text-white text-2xl">
                🂠
              </div>
            )}
          </div>
        </div>

        {/* Your Hand */}
        <div className="flex gap-3 mt-6 flex-wrap justify-center">
          {hand.length === 0 && (
            <div className="text-white/80 text-sm italic">You have no cards.</div>
          )}
          {hand.map(card => {
            if (!card) return null;
            const playable = isValidPlay(card, topCard);
            const disabled = gameStatus !== 'in_progress' || !isMyTurn || !playable;
            return (
              <button
                key={card}
                onClick={() => playCard(card)}
                disabled={disabled}
                className={`w-20 h-28 rounded-lg border shadow-lg flex items-center justify-center text-lg font-bold transition-transform
                           ${disabled
                             ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                             : 'bg-white text-black cursor-pointer hover:scale-105'}
                           ${isMyTurn ? 'ring-1 ring-yellow-400' : ''}`}
                title={isMyTurn ? (playable ? 'Play this card' : 'Card does not match value/suit') : 'Not your turn'}
              >
                {card}
              </button>
            );
          })}
        </div>

        {/* Player Actions */}
        <div className="absolute bottom-6 left-6 flex gap-3">
          {gameStatus === 'waiting' && (
            <button
              onClick={startGame}
              disabled={isStartingGame || connectedPlayers.length < 2}
              className={`px-3 py-2 rounded text-white transition-colors
                ${isStartingGame || connectedPlayers.length < 2
                  ? 'bg-gray-500 cursor-not-allowed'
                  : 'bg-green-500 hover:bg-green-600'}`}
              title={connectedPlayers.length < 2 ? 'Need at least 2 players' : 'Start game'}
            >
              {isStartingGame ? 'Starting...' : 'Start Game'}
            </button>
          )}
          <button
            onClick={leaveGame}
            className="px-3 py-2 rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
          >
            Leave Game
          </button>
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`flex items-center gap-2 px-3 py-2 rounded transition-colors ${
              isChatOpen
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            {isChatOpen ? 'Close Chat' : 'Open Chat'}
          </button>
        </div>

        {/* Turn indicator (top-right) */}
        <div className="absolute top-6 right-6">
          {currentTurn !== null && (
            <div className="px-3 py-2 rounded bg-black/30 text-white text-sm">
              {isMyTurn ? 'Your turn' : `Player ${currentTurn}'s turn`}
            </div>
          )}

          {/* Room Rules */}
          {room.rules && room.rules.length > 0 && (
            <div className="mt-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 w-64">
              <h3 className="font-semibold text-yellow-800 dark:text-yellow-300 mb-2">Room Rules</h3>
              <ul className="list-disc list-inside text-yellow-700 dark:text-yellow-400 space-y-1 text-sm">
                {room.rules.map((rule, index) => (
                  <li key={index}>{rule}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Chat Panel */}
        <RoomChat
          roomId={room.id}
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
        />
      </div>
    </AppLayout>
  );
}

export default Board;
