// pages/cardgame/FindRoom.tsx
import AppLayout from '@/layouts/app-layout';
import { Head, router } from "@inertiajs/react";
import RoomCard from '@/components/FindRoom/RoomCard';


type Room = {
    id: number;
    room_name: string;
    rules: {
        public: boolean;
        max_players: number;
        turn_timeout_seconds?: number;
        rules: string[];
    };
    game?: {
        game_status: 'waiting' | 'starting' | 'in_progress' | 'finished';
    } | null;
    players?: Array<{ id: number; name: string }> | null;
};

type Props = {
    rooms: Room[];
    auth: {
        user: {
            id: number;
            name: string;
            email: string;
        };
    };
};

export default function FindRoom({ rooms, auth }: Props) {
    return (
        <AppLayout>
            <Head title="Find a Room" />
            <div className="p-4 md:p-6 space-y-6 min-h-[100dvh]">
                <div className="max-w-6xl mx-auto">
                    <h1 className="text-4xl font-bold mb-2 text-center text-zinc-900 dark:text-zinc-100" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Find a Room</h1>
                    <p className="text-center text-zinc-600 dark:text-zinc-300 mb-8">Join an existing table or jump into a fresh room.</p>

                    {rooms.length === 0 ? (
                        <div className="text-center py-12 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5">
                            <div className="text-6xl mb-4">🎮</div>
                            <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">No rooms available</h3>
                            <p className="text-zinc-600 dark:text-zinc-300 mb-6">Be the first to spin up a room.</p>
                            <button 
                                onClick={() => router.visit('/createRoom')}
                                className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
                            >
                                Create Room
                            </button>
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {rooms.map((room) => (
                            <RoomCard key={room.id} room={room} currentUserId={auth.user.id} />
                        ))}
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
