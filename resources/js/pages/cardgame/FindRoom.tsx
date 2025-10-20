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
            <div className="p-6 space-y-6 min-h-screen">
                <div className="max-w-6xl mx-auto">
                    <h1 className="text-4xl font-bold mb-2 text-center text-gray-900 dark:text-white">Find a Room</h1>
                    <p className="text-center text-gray-600 dark:text-gray-300 mb-8">Join an existing game or browse available rooms</p>

                    {rooms.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="text-6xl mb-4">🎮</div>
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No rooms available</h3>
                            <p className="text-gray-600 dark:text-gray-300 mb-6">Be the first to create a game room!</p>
                            <button 
                                onClick={() => router.visit('/cardgame/create-room')}
                                className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
                            >
                                Create Room
                            </button>
                        </div>
                    ) : (
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
