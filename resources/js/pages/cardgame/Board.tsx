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
import { isValidPlay } from '@/utils/gameLogic';
import { playCardApi, pickupCardApi } from '@/utils/api';

type Player = { id: number; name?: string };

type Room = {
  id: number;
  code: string;
  rules: string[];
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
    const privateChannelRef = useRef<AnyChannel | null>(null);


    // Helper: unique members by id/user_id
    function uniqById<T extends { id?: string|number; user_id?: string|number }>(arr: T[]): T[] {
    const map = new Map<string, T>();
    for (const item of arr) {
        const raw = item.id ?? item.user_id;
        if (raw !== undefined) map.set(String(raw), item);
    }
    return [...map.values()];
    }


    useEffect(() => {
    const fetchState = async () => {
        try {
        const res = await fetch(`/board/${room.id}/resync-state`, {
            headers: {
            'Accept': 'application/json',
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
            ...(echo?.socketId?.() ? { 'X-Socket-Id': echo.socketId() } : {}),
            },
        });

        const ct = res.headers.get('content-type') ?? '';
        if (!res.ok && !ct.includes('application/json')) {
            // Surface HTML errors clearly instead of crashing on res.json()
            const text = await res.text();
            throw new Error(`Resync failed (${res.status}). ${text.slice(0, 200)}…`);
        }
        const data = ct.includes('application/json') ? await res.json() : {};

        setHand(Array.isArray(data.hand) ? data.hand : []);
        setHandCounts(data.hand_counts ?? {});
        setDeckCount(data.deck_count ?? 0);
        setTopCard(data.used_cards?.length ? data.used_cards.at(-1)! : null);
        setCurrentTurn(data.current_turn ?? null);
        } catch (err) {
        console.error('Resync failed:', err);
        }
    };

    fetchState();
    }, [room.id]);

  // --- Presence room channel: subscribe once per room.id
  useEffect(() => {
    if (!echo) return;

    const roomChannel = echo.join(`room-${room.id}`);
    roomChannelRef.current = roomChannel;
    
    type PresenceMember = { id: number; name?: string;};
    roomChannel.here((members: PresenceMember[]) => {
      const players: Player[] = (members ?? []).map(m => ({
        id: m.id,
        name: m.name ?? `Player ${m.id}`,
      }));
      setConnectedPlayers(uniqById(players));
    });

    roomChannel.joining((member: PresenceMember) => {
      const player: Player = { id: member.id, name: member.name ?? `Player ${member.id}` };
      setConnectedPlayers(prev => uniqById([...(prev ?? []), player]));
    });

    roomChannel.leaving((member: PresenceMember) => {
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
            roomChannel.stopListening('.game-started');
            roomChannel.stopListening('.card-played');
        } finally {
            echo.leave(`room-${room.id}`);
        }
        roomChannelRef.current = null;
    };

  }, [room.id]);

  // --- Private user channel: subscribe once per userId
  useEffect(() => {
    if (!echo) return;

    const privateChannel = echo.private(`user-${userId}`);
    privateChannelRef.current = privateChannel;

    privateChannel.listen('.hand-synced', (data: { hand: string[] }) => {
      setHand(data.hand ?? []);
    });

    return () => {
        try {
            privateChannel.stopListening('.hand-synced');
        } finally {
            echo.leave(`user-${userId}`);
        }
        privateChannelRef.current = null;
    };

  }, [userId]);

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
            'Accept': 'application/json',
            'X-Socket-Id': echo?.socketId?.() ?? '',
            },
            onError: () => setIsStartingGame(false),
            onFinish: () => setTimeout(() => setIsStartingGame(false), 2500),
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
        'X-Socket-Id': echo?.socketId?.() ?? '',
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
