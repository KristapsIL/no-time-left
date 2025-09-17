import React, { useState, useEffect, useRef } from 'react';
import { Head, router } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import RoomChat from '@/components/RoomChat';
import { MessageCircle } from 'lucide-react';
import Echo from 'laravel-echo';

type Props = { 
  room: { id: number; code: string; rules: string[]; player_hands?: Record<string, string[]> };
  deck: string[];
  userId: number;
};

function Board({ room, deck, userId }: Props) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [hand, setHand] = useState<string[]>(room.player_hands?.[String(userId)] || []);
  const [currentDeck, setCurrentDeck] = useState(deck);
  const hasLeftRef = useRef(false);

  useEffect(() => {
    const echo = new Echo({
      broadcaster: 'pusher',
      key: import.meta.env.VITE_PUSHER_APP_KEY,
      cluster: import.meta.env.VITE_PUSHER_APP_CLUSTER,
      forceTLS: true,
    });

    const channelName = `room-${room.id}`;
    const channel = echo.channel(channelName);

    channel.listen('.game-started', (data: any) => {
      if (data.player_hands && data.player_hands[userId]) {
        setHand(data.player_hands[userId]);
      }
      if (data.deck) {
        setCurrentDeck(data.deck);
      }
    });

    return () => {
      echo.leaveChannel(channelName);
      // Optional: fully disconnect if you create a new Echo per page
      try { (echo as any).disconnect?.(); } catch {}
    };
  }, [room.id, userId]);

  useEffect(() => {
    const token = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';

    const leaveOnce = () => {
      if (hasLeftRef.current) return;
      hasLeftRef.current = true;

      // Prefer sendBeacon (non-blocking during unload)
      const fd = new FormData();
      fd.append('_method', 'DELETE'); // method spoof
      if (token) fd.append('_token', token); // CSRF

      const ok = navigator.sendBeacon(`/leaveroom/${room.id}`, fd);

      // Fallback / SPA navigation cleanup (some browsers ignore sendBeacon in SPA transitions)
      if (!ok) {
        fetch(`/leaveroom/${room.id}`, {
          method: 'POST',
          headers: { 'X-CSRF-TOKEN': token },
          body: new URLSearchParams({ _method: 'DELETE' }),
          keepalive: true,
        }).catch(() => {});
      }
    };

    // When tab/window is closing or reloading
    const onBeforeUnload = () => leaveOnce();
    // iOS/Safari sometimes prefer pagehide
    const onPageHide = () => leaveOnce();

    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('pagehide', onPageHide);

    // When this component unmounts (e.g., navigating to another Inertia page)
    return () => {
      leaveOnce();
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [room.id]);

  const startGame = () => {
    router.post(
      `/board/${room.id}/start-game`,
      {},
      {
        preserveState: true,
        onSuccess: () => {
          console.log('Game started! Waiting for hands...');
        },
        onError: (errors) => {
          console.error(errors);
        },
      }
    );
  };

  const leaveGame = () => {
    hasLeftRef.current = false; // allow explicit leave even if cleanup ran earlier
    router.delete(`/leaveroom/${room.id}`, {
      preserveState: true,
      onFinish: () => { hasLeftRef.current = true; },
    });
  };

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
                        <button
                            onClick={startGame}
                            className="px-3 py-2 rounded bg-green-500 text-white hover:bg-green-600 transition-colors"
                        >
                            Start Game
                        </button>
                        <button
                            onClick={leaveGame}
                            className="px-3 py-2 rounded bg-green-500 text-white hover:bg-green-600 transition-colors"
                        >
                            leave Game
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

                {/* Player Hand */}
                <div className="bg-background rounded-lg border border-sidebar-border p-6">
                    <h2 className="text-lg font-semibold mb-4 text-foreground">Your Hand</h2>
                    <div className="flex gap-2 flex-wrap">
                        {hand.map((card) => (
                            <div key={card} className="px-3 py-2 bg-neutral-100 dark:bg-neutral-800 border border-input rounded-lg text-foreground">
                                {card}
                            </div>
                        ))}
                        {hand.length === 0 && <p className="text-gray-500">Waiting for game to start...</p>}
                    </div>
                </div>

                {/* Deck */}
                <div className="bg-background rounded-lg border border-sidebar-border p-6">
                    <h2 className="text-lg font-semibold mb-4 text-foreground">Deck</h2>
                    <div className="flex gap-2 flex-wrap">
                        {currentDeck.map((card) => (
                            <div key={card} className="px-3 py-2 bg-neutral-100 dark:bg-neutral-800 border border-input rounded-lg text-foreground">
                                {card}
                            </div>
                        ))}
                        {currentDeck.length === 0 && <p className="text-gray-500">Deck is empty</p>}
                    </div>
                </div>
                <div className="bg-background rounded-lg border p-4">
                    <h2>Your Hand</h2>
                    <div className="flex gap-2 flex-wrap">
                        {hand.map(card => (
                            <div key={card} className="px-3 py-2 border rounded">
                                {card}
                            </div>
                        ))}
                        {hand.length === 0 && <p>Waiting for game to start...</p>}
                    </div>
                </div>
                <div className="bg-background rounded-lg border p-4">
                    <h2>Remaining Deck</h2>
                    <p>{currentDeck.length} cards left</p>
                </div>
                {/* Room rules */}
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
