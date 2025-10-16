import { router } from "@inertiajs/react";

type Room = {
  id: number;
  room_name: string;
  rules: {
    public: boolean;
    max_players: number;
    rules: string[];
  };
};

export default function RoomCard({ room }: { room: Room }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-neutral-900 shadow hover:shadow-lg transition p-4 flex flex-col justify-between">
      <div>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
          {room.room_name}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Max Players: {room.rules.max_players}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          {room.rules.public ? "Public Room" : "Private Room"}
        </p>
        {room.rules.rules.length > 0 && (
          <p className="text-xs text-gray-500 mt-2">
            Rules: {room.rules.rules.join(", ")}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => router.visit(`/joinroom/${room.id}`)}
        className="mt-4 w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
      >
        Join Room
      </button>
    </div>
  );
}