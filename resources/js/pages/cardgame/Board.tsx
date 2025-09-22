import React, { useState, useEffect, useRef } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import RoomChat from '@/components/RoomChat';
import { MessageCircle, Spade } from 'lucide-react';
import Echo from 'laravel-echo';

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


    useEffect(() => {
    const off = router.on('before', (event) => {
        const id = (window as any).Echo?.socketId?.();
        if (id) event.detail.visit.headers['X-Socket-ID'] = id; // attach only when available
    });
    return () => off();
    }, []);

  useEffect(() => {
    const uid = String(userId);
    setHand(room.player_hands?.[uid] ?? []);
    setCurrentDeck(deck ?? []);
    setTopCard(room.used_cards?.length ? room.used_cards.at(-1)! : null);
    setGameStatus(room.game_status || 'waiting');
  }, [room.player_hands, room.used_cards, room.game_status, deck, userId]);

  useEffect(() => {
    const echo = new Echo({
      broadcaster: 'pusher',
      key: import.meta.env.VITE_PUSHER_APP_KEY,
      cluster: import.meta.env.VITE_PUSHER_APP_CLUSTER,
      forceTLS: true,
    });

    const channelName = `room-${room.id}`;
    const uid = String(userId);
    const channel = echo.join(channelName);

    channel.listen('.game-started', (data: any) => {
      console.log('🎮 Game started event received:', data);
      
      // Update game status
      setGameStatus('in_progress');
      setIsStartingGame(false);
      
      // Update player hands
      if (data.player_hands && data.player_hands[uid]) {
        console.log('Setting hand for user', uid, ':', data.player_hands[uid]);
        setHand([...data.player_hands[uid]]);
      }
      
      // Update deck
      if (Array.isArray(data.deck)) {
        setCurrentDeck([...data.deck]);
      }
      
      // Update top card
      if (Array.isArray(data.used_cards) && data.used_cards.length > 0) {
        const newTopCard = data.used_cards.at(-1) as string;
        console.log('Setting top card:', newTopCard);
        setTopCard(newTopCard);
      } else {
        setTopCard(null);
      }
    });

    // Card played
    channel.listen('.card-played', (data: any) => {
      console.log('Card played event received:', data);

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

    // Presence member tracking
    channel.here((members: any[]) => {
      console.log('👥 Current members:', members);
      setConnectedPlayers(members);
    });

    channel.joining((member: any) => {
      console.log('👋 Member joined:', member);
      setConnectedPlayers(prev => [...prev, member]);
    });

    channel.leaving((member: any) => {
      console.log('👋 Member left:', member);
      setConnectedPlayers(prev => prev.filter(p => p.id !== member.id));
    });

    return () => {
      echo.leave(channelName); // cleanly leave presence channel
      try { (echo as any).disconnect?.(); } catch {}
    };
  }, [room.id, userId]);

  useEffect(() => {
    const token = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';

    const leaveOnce = () => {
      if (hasLeftRef.current) return;
      hasLeftRef.current = true;

      const fd = new FormData();
      fd.append('_method', 'DELETE');
      if (token) fd.append('_token', token);

      const ok = navigator.sendBeacon(`/leaveroom/${room.id}`, fd);

      if (!ok) {
        fetch(`/leaveroom/${room.id}`, {
          method: 'POST',
          headers: { 'X-CSRF-TOKEN': token },
          body: new URLSearchParams({ _method: 'DELETE' }),
          keepalive: true,
        }).catch(() => {});
      }
    };

    const isNavigatingAway = () => {
      return document.visibilityState === 'hidden' && performance.navigation.type !== 1;
    };

    const onPageHide = () => {
      if (isNavigatingAway()) leaveOnce();
    };

    window.addEventListener('pagehide', onPageHide);

    return () => {
      leaveOnce();
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [room.id]);

    const startGame = () => {
        if (isStartingGame) return; // Prevent double clicks
        
        setIsStartingGame(true);
        
        router.post(`/board/${room.id}/start-game`, {}, {
            preserveState: true,
            headers: { 'X-Socket-ID': (window as any).Echo?.socketId?.() ?? '' },
            onSuccess: () => {
                console.log(' Start game request successful');
            },
            onError: (errors) => {
                console.error('❌ Start game failed:', errors);
                setIsStartingGame(false);
                alert('Failed to start game: ' + (errors.message || 'Unknown error'));
            },
            onFinish: () => {
                setTimeout(() => setIsStartingGame(false), 3000);
            }
        });
    };


  const leaveGame = () => {
    hasLeftRef.current = false;
    router.delete(`/leaveroom/${room.id}`, {
      preserveState: true,
      onFinish: () => { hasLeftRef.current = true; },
    });
  };

  const isValidPlay = (card: string, topCard: string | null): boolean => {
    if (!topCard) return true;

    const cardValue = card.slice(0, -1);
    const cardSuit = card.slice(-1);

    const topValue = topCard.slice(0, -1);
    const topSuit = topCard.slice(-1);

    return cardValue === topValue || cardSuit === topSuit;
  };

  const playCard = async (card: string) => {
    const previousHand = hand;
    const previousTopCard = topCard;
    setHand(prev => prev.filter(c => c !== card));
    setTopCard(card);

    try {
      const response = await fetch(`/board/${room.id}/play-card`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
        },
        body: JSON.stringify({ card }),
      });

      if (!response.ok) {
        let errorMessage = `Error ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
        }
        throw new Error(errorMessage);
      }

      console.log(`Card ${card} confirmed by server`);
      
    } catch (error) {
      console.error('Invalid move:', error);
      
      setHand(previousHand);
      setTopCard(previousTopCard);
      
      const errorMessage = error instanceof Error ? error.message : 'Invalid move! You can\'t play that card.';
      alert(errorMessage);
    }
  };

  const handlePlayCard = (card: string) => {
    if (!isValidPlay(card, topCard)) {
      return;
    }
    playCard(card);
  };
  const pickup = () => {
    router.put(`/board/${room.id}/pickup`, {});
  }

  console.log('player_hands:', room.player_hands);
  console.log('userId:', userId);
  console.log('hand:', hand);
  console.log('topcard:', topCard);

  return (
    <AppLayout>
      <Head title={`Board - Room ${room.code}`} />
      <div className={`p-6 space-y-4 transition-all duration-300 ${isChatOpen ? 'mr-80' : ''}`}>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Room {room.code}</h1>
            <p className="text-sm text-muted-foreground">Game Board</p>
          </div>
          <div className="flex items-center gap-2">
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
            
            {gameStatus === 'in_progress' && (
              <div className="px-3 py-2 rounded bg-blue-500 text-white">
                Game in Progress
              </div>
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
        </div>

        {/* Connected Players */}
        <div className="bg-background rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-2">Players in Room ({connectedPlayers.length})</h2>
          <div className="flex gap-2 flex-wrap">
            {connectedPlayers.map((player) => (
              <div
                key={player.id}
                className={`px-3 py-1 rounded-full text-sm ${
                  player.id === userId 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-neutral-200 dark:bg-neutral-700 text-foreground'
                }`}
              >
                {player.name} {player.id === userId && '(You)'}
              </div>
            ))}
            {connectedPlayers.length === 0 && (
              <p className="text-muted-foreground">Connecting...</p>
            )}
          </div>
        </div>

        {/* Top Card */}
        <div className="bg-background rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-2">Top Card</h2>
          {topCard ? (
            <div className="px-3 py-2 border rounded text-xl">{topCard}</div>
          ) : (
            <p className="text-gray-500">No card on table yet</p>
          )}
        </div>

        {/* Player Hand */}
        <div className="bg-background rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-2">Your Hand</h2>
          <div className="flex gap-2 flex-wrap">
            {hand.map((card) => (
              <button
                key={card}
                onClick={() => handlePlayCard(card)}
                disabled={gameStatus !== 'in_progress'}
                className={`px-3 py-2 bg-neutral-100 dark:bg-neutral-800 border border-input rounded-lg text-foreground transition-colors ${
                  gameStatus === 'in_progress' 
                    ? 'hover:bg-blue-100 dark:hover:bg-blue-700 cursor-pointer' 
                    : 'opacity-50 cursor-not-allowed'
                }`}
              >
                {card}
              </button>
            ))}
            {hand.length === 0 && gameStatus === 'waiting' && (
              <p className="text-muted-foreground">Waiting for game to start...</p>
            )}
            {hand.length === 0 && gameStatus === 'in_progress' && (
              <p className="text-muted-foreground">No cards in hand!</p>
            )}
          </div>
        </div>
        <div className="bg-background rounded-lg border p-4">
            <h2 className="text-lg font-semibold mb-2">Pick Up</h2>
          <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => pickup()}
                disabled={gameStatus !== 'in_progress'}
                className={`px-3 py-2 bg-neutral-100 dark:bg-neutral-800 border border-input rounded-lg text-foreground transition-colors ${
                  gameStatus === 'in_progress' 
                    ? 'hover:bg-blue-100 dark:hover:bg-blue-700 cursor-pointer' 
                    : 'opacity-50 cursor-not-allowed'
                }`}
              >
                🂠
              </button>
            {hand.length === 0 && gameStatus === 'waiting' && (
              <p className="text-muted-foreground">Waiting for game to start...</p>
            )}
          </div>
        </div>

        {/* Deck Info */}
        <div className="bg-background rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-2">Remaining Deck</h2>
          <p>{currentDeck.length} cards left</p>
        </div>

        {/* Room Rules */}
        {room.rules && room.rules.length > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
            <h3 className="font-semibold text-yellow-800 dark:text-yellow-300 mb-2">Room Rules</h3>
            <ul className="list-disc list-inside text-yellow-700 dark:text-yellow-400 space-y-1">
              {room.rules.map((rule, index) => (
                <li key={index}>{rule}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Chat */}
      <RoomChat 
        roomId={room.id} 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)} 
      />
    </AppLayout>
  );
}

export default Board;


