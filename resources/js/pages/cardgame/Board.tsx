import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { router } from '@inertiajs/react';
import { usePage } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import RoomChat from '@/components/RoomChat';
import echo from '@/lib/echo';
import { PlayerHand } from '@/components/Board/PlayerHand';
import { OtherPlayers } from '@/components/Board/OtherPlayers';
import { Deck } from '@/components/Board/Deck';
import { TopCard } from '@/components/Board/TopCard';
import { GameControls } from '@/components/Board/GameControls';
import { isValidPlay, uniqById } from '@/utils/gameLogic';
import { playCardApi, pickupCardApi } from '@/utils/api';

type Room = {
  id: number;
  code: string;
  rules: string[];
  player_hands?: Record<string, string[]>;
  used_cards?: string[];
  game_status?: 'waiting' | 'in_progress' | 'finished';
  players?: { id: number; name?: string }[];
};

type Props = {
  room: Room;
  deck: string[];
  userId: number;
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

    useEffect(() => {
    if (!echo) return;

    const roomChannel = echo.join(`room-${room.id}`);

    roomChannel.here((members: any[]) => setConnectedPlayers(uniqById(members)));

    roomChannel.joining((member: any) =>
        setConnectedPlayers(prev => uniqById([...(prev ?? []), member]))
    );

    roomChannel.leaving((member: any) =>
        setConnectedPlayers(prev =>
        (prev ?? []).filter(p => p.id !== member.id)
        )
    );

    roomChannel.listen('.card-played', (data: any) => {
        setTopCard(data.used_cards?.at(-1) ?? topCard);
        if (data.hand_counts) setHandCounts({ ...data.hand_counts });
        if (Number.isInteger(data.deck_count)) setDeckCount(data.deck_count);
        if (Number.isInteger(data.turn_player_id)) setCurrentTurn(data.turn_player_id);
    });

    return () => echo.leave(`room-${room.id}`);
    }, [room.id, topCard]);
    const startGame = useCallback(() => {

    if (isStartingGame) return;

    setIsStartingGame(true);

    router.post(`/board/${room.id}/start-game`, {}, {
        preserveState: true,
        headers: {
        'X-Socket-Id': (echo as any)?.socketId?.() ?? '',
        },
        onError: (errors) => {
        setIsStartingGame(false);
        alert('Failed to start game: ' + (errors?.message || 'Unknown error'));
        },
        onFinish: () => {
        setTimeout(() => setIsStartingGame(false), 2500);
        },
    });
    }, [isStartingGame, room.id]);



    // ----- Play card -----
    const playCard = useCallback(async (card: string) => {
        if (!isMyTurn || !isValidPlay(card, topCard)) return;
        try {
        await playCardApi(room.id, card);
        setHand(prev => prev.filter(c => c !== card));
        setTopCard(card);
        } catch (err) {
        console.error(err);
        }
    }, [topCard, isMyTurn, room.id]);

    // ----- Pickup card -----
    const pickupCard = useCallback(async () => {
        if (!isMyTurn) return;
        try {
        await pickupCardApi(room.id);
        } catch (err) {
        console.error(err);
        }
    }, [isMyTurn, room.id]);


    const hasLeftRef = useRef(false);

    const leaveGame = useCallback(() => {
    hasLeftRef.current = false;
    router.delete(`/leaveroom/${room.id}`, {
        preserveState: true,
        headers: {
        'X-Socket-Id': (echo as any)?.socketId?.() ?? '',
        },
        onFinish: () => {
        hasLeftRef.current = true;
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
          <Deck
            deckCount={deckCount}
            isMyTurn={isMyTurn}
            pickupCard={pickupCard}
            />
          <TopCard topCard={topCard} />
        </div>

        {/* Player hand */}
        <PlayerHand
            hand={hand}
            topCard={topCard}
            isMyTurn={isMyTurn}
            playCard={playCard}
        />


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
        <RoomChat
          roomId={room.id}
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
        />

      </div>
    </AppLayout>
  );
}
