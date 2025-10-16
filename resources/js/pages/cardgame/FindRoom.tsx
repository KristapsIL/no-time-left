// pages/cardgame/FindRoom.tsx
import AppLayout from '@/layouts/app-layout';
import { Head } from "@inertiajs/react";
import RoomCard from '@/components/FindRoom/RoomCard';


type Room = {
    id: number;
    room_name: string;
    rules: {
        public: boolean;
        max_players: number;
        rules: string[];
    };
};

type Props = {
    rooms: Room[];
};

export default function FindRoom({ rooms }: Props) {
    return (
        <AppLayout>
            <Head title="Find a Room" />
            <div className="p-6 space-y-4">
                <h1 className="text-xl font-bold mb-4">Rooms</h1>

                {rooms.length === 0 ? (
                    <p>No rooms found</p>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {rooms.map((room) => (
                        <RoomCard key={room.id} room={room} />
                    ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
