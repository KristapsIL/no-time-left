import AppLayout from '@/layouts/app-layout';
import { Head, router} from "@inertiajs/react";

type Room = {
    id: number;
    code: string;
    public: boolean;
    max_players: number;
    rules: string[];
};

type Props = {
    rooms: Room[];
};
function FindRoom({ rooms }: Props) {
    return (
        <AppLayout>
            <Head title="Find a Room" />
            <div className="p-6 space-y-4">
                <h1 className="text-xl font-bold mb-4">Available Rooms</h1>

                {rooms.length === 0 ? (<p>No rooms found</p>) : (
                    <div className="space-y-2">
                        {rooms.map((room) => (
                            <div key={room.id} className="border p-3 rounded">
                                <p>Max Players: {room.max_players}</p>
                                <p>Public: {room.public ? "Yes" : "No"}</p>
                                <p>Rules: {room.rules.join(", ")}</p>
                                <button
                                    type="button"
                                    className="px-3 py-1 bg-indigo-600 text-white rounded"
                                    onClick={() => router.visit(`/joinroom/${room.id}`)}>
                                    Join
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
export default FindRoom;