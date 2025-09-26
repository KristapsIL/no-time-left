import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { router, usePage } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import RoomChat from '@/components/RoomChat';
import echo from '@/lib/echo';
import { PlayerHand } from '@/components/Board/PlayerHand';
import { OtherPlayers } from '@/components/Board/OtherPlayers';
import { Deck } from '@/components/Board/Deck';
import { TopCard } from '@/components/Board/TopCard';
import { GameControls } from '@/components/Board/GameControls';
import { isValidPlay, uniqById} from '@/utils/gameLogic';
import { playCardApi, pickupCardApi } from '@/utils/api';

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
  // snake_case fallbacks
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
  // snake_case fallbacks
  used_cards?: string[];
  hand_counts?: Record<string, number>;
  deck_count?: number;
  turn_player_id?: number;
};

export default function Board() {
  const { props } = usePage<Props>();
  const { room, deck, userId } = props;
  const uid = String(userId);

  const [hand, setHand] = useState<string[]>(room.player_hands?.[uid] ?? []);
  const [deckCount, setDeckCount] = useState<number>(deck?.length ?? 0);
  const [topCard, setTopCard] = useState<string | null>(room.used_cards?.at(-1) ?? null);
  const [connectedPlayers, setConnectedPlayers] = useState<Room['players']>(room.players ?? []);
  const [handCounts, setHandCounts] = useState<Record<string, number>>({});
  const [currentTurn, setCurrentTurn] = useState<number | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isStartingGame, setIsStartingGame] = useState(false);

  const isMyTurn = useMemo(() => currentTurn === userId, [currentTurn, userId]);

    type AnyChannel = {
    listen: (event: string, cb: (payload: unknown) => void) => AnyChannel;
    stopListening: (event: string, cb?: (payload: unknown) => void) => AnyChannel;
    };
    const roomChannelRef = useRef<AnyChannel | null>(null);

     // Helper: unique members by id/user_id
    function uniqById<T extends { id?: string|number; user_id?: string|number }>(arr: T[]): T[] {
        const map = new Map<string, T>();
        for (const item of arr) {
            const raw = item.id ?? item.user_id;
            if (raw !== undefined) map.set(String(raw), item);
        }
        return [...map.values()];
    }

  // --- Presence room channel: subscribe once per room.id
  useEffect(() => {
    if (!echo) return;

    const roomChannel = echo.join(`room-${room.id}`);
    roomChannelRef.current = roomChannel;

    // Normalize members to { id, name }
    roomChannel.here((members: any[]) => {
      const players: Player[] = (members ?? []).map(m => ({
        id: m.id,
        name: m.name ?? `Player ${m.id}`,
      }));
      setConnectedPlayers(uniqById(players));
    });

    roomChannel.joining((member: any) => {
      const player: Player = { id: member.id, name: member.name ?? `Player ${member.id}` };
      setConnectedPlayers(prev => uniqById([...(prev ?? []), player]));
    });

    roomChannel.leaving((member: any) => {
      setConnectedPlayers(prev => (prev ?? []).filter(p => p.id !== member.id));
    });

    // Game events
    roomChannel.listen('.game-started', (data: GameStartedPayload) => {
      const turn = data.turnPlayerId ?? data.turn_player_id ?? null;
      const deckC = data.deckCount ?? data.deck_count ?? 0;
      const counts = data.handCounts ?? data.hand_counts ?? {};
      const used = (data.usedCards ?? data.used_cards) ?? [];

      setIsStartingGame(false);
      setCurrentTurn(turn);
      setDeckCount(deckC);
      setHandCounts(counts);
      setTopCard(used.at(-1) ?? null);
    });

    roomChannel.listen('.card-played', (data: CardPlayedPayload) => {
      const used = (data.usedCards ?? data.used_cards) ?? [];
      const counts = data.handCounts ?? data.hand_counts;
      const deckC = data.deckCount ?? data.deck_count;
      const turn = data.turnPlayerId ?? data.turn_player_id;

      setTopCard(prev => used.at(-1) ?? prev);
      if (counts) setHandCounts({ ...counts });
      if (Number.isInteger(deckC)) setDeckCount(deckC as number);
      if (Number.isInteger(turn)) setCurrentTurn(turn as number);
    });

    return () => {
      try {
        echo.leave(`room-${room.id}`);
      } catch {}
      roomChannelRef.current = null;
    };
  }, [room.id]);

  // --- Private user channel: subscribe once per userId
// helper
const resync = useCallback(async () => {
  try {
    const res = await fetch(`/board/${room.id}/resync-state`, {
      method: 'GET', // or GET if your route is GET
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '',
      },
    });
    if (!res.ok) return; // optionally handle errors
    const data = await res.json();
    setHand(data.hand ?? []);
    setHandCounts(data.hand_counts ?? {});
    setDeckCount(data.deck_count ?? 0);
    setTopCard((data.used_cards ?? []).at(-1) ?? null);
    setCurrentTurn(data.current_turn ?? null);
  } catch (e) {
    console.error('resync failed', e);
  }
}, [room.id]);

useEffect(() => {
  const onFocus = () => resync();
  const onVisible = () => { if (document.visibilityState === 'visible') resync(); };

  window.addEventListener('focus', onFocus);
  document.addEventListener('visibilitychange', onVisible);

  // Pusher/Reverb reconnect hooks (guard for whichever driver you use)
  try {
    // Pusher-style
    (echo as any)?.connector?.pusher?.connection?.bind('connected', resync);
    (echo as any)?.connector?.pusher?.connection?.bind('reconnected', resync);
  } catch {}
  try {
    // Reverb/Ably may expose different hooks; call resync after connection open if available
    (echo as any)?.connector?.socket?.addEventListener?.('open', resync);
  } catch {}

  return () => {
    window.removeEventListener('focus', onFocus);
    document.removeEventListener('visibilitychange', onVisible);
    try {
      (echo as any)?.connector?.pusher?.connection?.unbind('connected', resync);
      (echo as any)?.connector?.pusher?.connection?.unbind('reconnected', resync);
      (echo as any)?.connector?.socket?.removeEventListener?.('open', resync);
    } catch {}
  };
}, [resync]);


  // ----- Start game -----
  const startGame = useCallback(() => {
    if (isStartingGame) return;

    setIsStartingGame(true);

    router.post(
      `/board/${room.id}/start-game`,
      {},
      {
        preserveState: true,
        headers: {
          'X-Socket-Id': (echo)?.socketId?.() ?? '',
        },
        onError: (errors) => {
          setIsStartingGame(false);
        },
        onFinish: () => {
          // safety to clear spinner even if server didn't broadcast
          setTimeout(() => setIsStartingGame(false), 2500);
        },
      }
    );
  }, [isStartingGame, room.id]);

  // ----- Play card -----
  const playCard = useCallback(
    async (card: string) => {
      if (!isMyTurn || !isValidPlay(card, topCard)) return;
      try {
        await playCardApi(room.id, card);
        // Optimistic update; server event will reconcile
        setHand(prev => prev.filter(c => c !== card));
        setTopCard(card);
      } catch (err) {
        console.error(err);
      }
    },
    [isMyTurn, topCard, room.id]
  );

  // ----- Pickup card -----
  const pickupCard = useCallback(async () => {
    if (!isMyTurn) return;
    try {
      await pickupCardApi(room.id);
      // Server should push new hand via `.hand-synced`
    } catch (err) {
      console.error(err);
    }
  }, [isMyTurn, room.id]);

  // ----- Leave game -----
  const leaveGame = useCallback(() => {
    router.delete(`/leaveroom/${room.id}`, {
      preserveState: true,
      headers: {
        'X-Socket-Id': (echo)?.socketId?.() ?? '',
      },
    });
  }, [room.id]);

  return (
    <AppLayout>
      <div className="w-full h-screen flex flex-col items-center justify-between p-6 bg-green-700">
        {/* Other players */}
        <OtherPlayers
          players={(connectedPlayers ?? []).filter(p => p?.id !== userId)}
          handCounts={handCounts}
          currentTurn={currentTurn}
          userId={userId}
        />

        {/* Center table: deck + top card */}
        <div className="flex gap-12 items-center justify-center flex-wrap">
          <Deck deckCount={deckCount} isMyTurn={isMyTurn} pickupCard={pickupCard} />
          <TopCard topCard={topCard} />
        </div>

        {/* Player hand */}
        <PlayerHand hand={hand} topCard={topCard} isMyTurn={isMyTurn} playCard={playCard} />

        {/* Game controls */}
        <GameControls
          roomId={room.id}
          isStartingGame={isStartingGame}
          connectedPlayers={connectedPlayers ?? []}
          isChatOpen={isChatOpen}
          toggleChat={() => setIsChatOpen(open => !open)}
          leaveGame={leaveGame}
          startGame={startGame}
        />

        {/* Chat panel */}
        <RoomChat roomId={room.id} isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
      </div>
    </AppLayout>
  );
}
