import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import RoomChat from '@/components/RoomChat';
import { MessageCircle, Spade } from 'lucide-react';
import echo from '@/lib/echo'; 

type Props = { 
  room: {
    id: number;
    code: string;
    rules: string[];
    player_hands?: Record<string, string[]>;
    used_cards?: string[];
    game_status?: string;
    players?: any[];
  };
  deck: string[];
  userId: number;
};

function Board(_initialProps: Props) {
  const { props } = usePage<Props>();
  const { room, deck, userId } = props;

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [hand, setHand] = useState<string[]>(room.player_hands?.[String(userId)] || []);
  const [currentDeck, setCurrentDeck] = useState(deck);
  const initialTopCard = room.used_cards?.length ? room.used_cards.slice(-1)[0] : null;
  const [topCard, setTopCard] = useState<string | null>(initialTopCard);
  const [gameStatus, setGameStatus] = useState(room.game_status || 'waiting');
  const [isStartingGame, setIsStartingGame] = useState(false);
  const [connectedPlayers, setConnectedPlayers] = useState<any[]>([]);

  const hasLeftRef = useRef(false);
  const startGameResetTimer = useRef<number | null>(null);

  const uid = String(userId);
  const channelName = `room-${room.id}`;

  // Attach X-Socket-Id to all Inertia navigations
  useEffect(() => {
    const off = router.on('before', (event) => {
      const id = window.Echo?.socketId?.();
      if (id) event.detail.visit.headers['X-Socket-Id'] = id;
    });
    return () => off();
  }, []);

  useEffect(() => {
    setHand(room.player_hands?.[uid] ?? []);
    setCurrentDeck(deck ?? []);
    setTopCard(room.used_cards?.length ? room.used_cards.at(-1)! : null);
    setGameStatus(room.game_status || 'waiting');
  }, [room.player_hands, room.used_cards, room.game_status, deck, uid]);

  useEffect(() => {
    const channel = echo.join(channelName);

    channel.listen('.game-started', (data: any) => {
      setGameStatus('in_progress');
      setIsStartingGame(false);

      if (data.player_hands && data.player_hands[uid]) {
        setHand([...data.player_hands[uid]]);
      }
      if (Array.isArray(data.deck)) {
        setCurrentDeck([...data.deck]);
      }
      if (Array.isArray(data.used_cards) && data.used_cards.length > 0) {
        setTopCard(data.used_cards.at(-1) as string);
      } else {
        setTopCard(null);
      }
    });

    channel.listen('.card-played', (data: any) => {
      if (Array.isArray(data.used_cards) && data.used_cards.length > 0) {
        const nextTop = data.used_cards.at(-1) as string;
        setTopCard(prev => (prev === nextTop ? prev : nextTop));
      }
      if (data.player_hands && data.player_hands[uid]) {
        setHand([...data.player_hands[uid]]);
      }
      if (Array.isArray(data.deck)) {
        setCurrentDeck([...data.deck]);
      }
    });

    const toMap = (arr: any[]) => {
      const m = new Map<string|number, any>();
      for (const p of arr) m.set(p.id ?? p.user_id ?? p, p);
      return m;
    };

    channel.here((members: any[]) => {
      setConnectedPlayers(Array.from(toMap(members).values()));
    });

    channel.joining((member: any) => {
      setConnectedPlayers(prev => {
        const m = toMap(prev);
        m.set(member.id ?? member.user_id ?? member, member);
        return Array.from(m.values());
      });
    });

    channel.leaving((member: any) => {
      setConnectedPlayers(prev => {
        const m = toMap(prev);
        m.delete(member.id ?? member.user_id ?? member);
        return Array.from(m.values());
      });
    });

    return () => {
      echo.leave(channelName);
    };
  }, [channelName, uid]);

  useEffect(() => {
    const token = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';

    const leaveOnce = () => {
      if (hasLeftRef.current) return;
      hasLeftRef.current = true;

      const fd = new FormData();
      fd.append('_method', 'DELETE');
      if (token) fd.append('_token', token);

      // Attach socket id to prevent self-echo
      const socketId = window.Echo?.socketId?.() ?? '';

      const ok = navigator.sendBeacon(`/leaveroom/${room.id}`, fd);
      if (!ok) {
        fetch(`/leaveroom/${room.id}`, {
          method: 'POST',
          headers: {
            'X-CSRF-TOKEN': token,
            'X-Socket-Id': socketId,
          },
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

  const isValidPlay = useCallback((card: string, top: string | null): boolean => {
    if (!top) return true;
    const cardValue = card.slice(0, -1);
    const cardSuit = card.slice(-1);
    const topValue = top.slice(0, -1);
    const topSuit = top.slice(-1);
    return cardValue === topValue || cardSuit === topSuit;
  }, []);

  const startGame = useCallback(() => {
    if (isStartingGame) return;

    setIsStartingGame(true);

    router.post(
      `/board/${room.id}/start-game`,
      {},
      {
        preserveState: true,
        headers: { 'X-Socket-Id': window.Echo?.socketId?.() ?? '' },
        onSuccess: () => {
          // ok
        },
        onError: (errors) => {
          setIsStartingGame(false);
          alert('Failed to start game: ' + (errors.message || 'Unknown error'));
        },
        onFinish: () => {
          if (startGameResetTimer.current) window.clearTimeout(startGameResetTimer.current);
          startGameResetTimer.current = window.setTimeout(() => setIsStartingGame(false), 3000);
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
    const previousHand = hand;
    const previousTopCard = topCard;
    setHand(prev => prev.filter(c => c !== card));
    setTopCard(card);

    const abort = new AbortController();
    try {
      const response = await fetch(`/board/${room.id}/play-card`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
          'X-Socket-Id': window.Echo?.socketId?.() ?? '',
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
      setHand(previousHand);
      setTopCard(previousTopCard);
      const errorMessage = error instanceof Error ? error.message : 'Invalid move! You can\'t play that card.';
      alert(errorMessage);
    }

    return () => abort.abort();
  }, [hand, topCard, room.id]);

  const handlePlayCard = useCallback((card: string) => {
    if (!isValidPlay(card, topCard)) return;
    void playCard(card);
  }, [isValidPlay, topCard, playCard]);

  const pickup = useCallback(() => {
    router.put(`/board/${room.id}/pickup`, {}, {
      preserveState: true,
      headers: { 'X-Socket-Id': window.Echo?.socketId?.() ?? '' },
    });
  }, [room.id]);

  const leaveGame = useCallback(() => {
    hasLeftRef.current = false;
    router.delete(`/leaveroom/${room.id}`, {
      preserveState: true,
      headers: { 'X-Socket-Id': window.Echo?.socketId?.() ?? '' },
      onFinish: () => { hasLeftRef.current = true; },
    });
  }, [room.id]);


  return (
  <AppLayout>
    <Head title={`Board - Room ${room.code}`} />

    <div className="relative w-full h-screen bg-green-700 p-6 flex flex-col items-center justify-between">

      {/* Top Players (other players) */}
      <div className="flex justify-center gap-8 mb-4">
        {connectedPlayers
          .filter(p => p.id !== userId)
          .map(player => (
            <div key={player.id} className="flex flex-col items-center">
              <div className="text-white text-sm mb-1">{player.name}</div>
              <div className="flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-12 h-16 bg-red-600 rounded shadow-md"
                  ></div>
                ))}
              </div>
            </div>
          ))}
      </div>

      {/* Table Center */}
      <div className="flex items-center justify-center gap-12 flex-wrap">

        {/* Remaining Deck */}
        <div className="relative w-20 h-28">
          <div className="absolute w-full h-full bg-gray-800 rounded-lg border shadow-md flex items-center justify-center text-white text-xl cursor-pointer hover:scale-105 transition-transform"
               onClick={pickup}>
            🂠
          </div>
          <p className="text-white text-center mt-2 text-sm">{currentDeck.length} left</p>
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
      <div className="flex gap-3 mt-6">
        {hand.map(card => (
          <button
            key={card}
            onClick={() => handlePlayCard(card)}
            disabled={gameStatus !== 'in_progress'}
            className={`w-20 h-28 rounded-lg border shadow-lg flex items-center justify-center text-lg font-bold cursor-pointer transition-transform hover:scale-105 ${
              isValidPlay(card, topCard) ? 'bg-white' : 'bg-gray-300 cursor-not-allowed'
            }`}
          >
            {card}
          </button>
        ))}
      </div>

      {/* Player Actions */}
      <div className="absolute bottom-6 left-6 flex gap-3">
        {gameStatus === 'waiting' && (
          <button
            onClick={startGame}
            disabled={isStartingGame}
            className={`px-3 py-2 rounded text-white transition-colors ${
              isStartingGame 
                ? 'bg-gray-500 cursor-not-allowed' 
                : 'bg-green-500 hover:bg-green-600'
            }`}
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

      {/* Room Rules */}
      {room.rules && room.rules.length > 0 && (
        <div className="absolute top-6 right-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 w-64">
          <h3 className="font-semibold text-yellow-800 dark:text-yellow-300 mb-2">Room Rules</h3>
          <ul className="list-disc list-inside text-yellow-700 dark:text-yellow-400 space-y-1 text-sm">
            {room.rules.map((rule, index) => (
              <li key={index}>{rule}</li>
            ))}
          </ul>
        </div>
      )}

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


