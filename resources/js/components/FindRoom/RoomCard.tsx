// components/RoomCard.tsx
import { router } from "@inertiajs/react";

type Room = {
    id: number;
    room_name: string;
    public: boolean;
    max_players: number;
    rules: string[];
};

export default function RoomCard({ room }: { room: Room }) {
    return (
        <div className="border p-3 rounded">
            <h2 className="text-lg font-semibold">{room.room_name}</h2>
            <p>Max Players: {room.max_players}</p>
            <p>Public: {room.public ? "Yes" : "No"}</p>
            <p>Rules: {room.rules.join(", ")}</p>
            <button
                type="button"
                className="mt-2 px-3 py-1 bg-indigo-600 text-white rounded"
                onClick={() => router.visit(`/joinroom/${room.id}`)}
            >
                Join
            </button>
        </div>
    );
}
