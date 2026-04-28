import { router } from "@inertiajs/react";
import { Trash2 } from "lucide-react";
import { useState } from "react";

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
    game_status: 'waiting' | 'starting' | 'in_progress' | 'paused' | 'finished';
  } | null;
  players?: Array<{ id: number; name: string }> | null;
};

// Vienas istabas kartīte istabas meklēšanas sarakstā
export default function RoomCard({ room, currentUserId, isAdmin }: { room: Room; currentUserId?: number; isAdmin?: boolean }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const currentPlayers = room.players?.length || 0;
  const maxPlayers = room.rules.max_players;
  const gameStatus = room.game?.game_status;
  const isRoomFull = currentPlayers >= maxPlayers;
  const isGameActive = gameStatus === 'starting' || gameStatus === 'in_progress';
  const isGamePaused = gameStatus === 'paused';
  const isGameFinished = gameStatus === 'finished';
  const isExistingPlayer = currentUserId && room.players?.some(player => player.id === currentUserId);
  const canJoin = isExistingPlayer || (!isRoomFull && !isGameActive && !isGameFinished);

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    router.delete(`/admin/rooms/${room.id}`);
  }

  return (
    <div className={`rounded-2xl border bg-white/85 dark:bg-[#0d1621]/85 backdrop-blur shadow hover:shadow-lg transition p-4 flex flex-col justify-between ${
      isExistingPlayer 
        ? 'border-cyan-300 dark:border-cyan-500 ring-1 ring-cyan-100 dark:ring-cyan-900/60' :
      canJoin 
        ? 'border-black/10 dark:border-white/10' 
        : 'border-black/15 dark:border-white/15 opacity-75'
    }`}>
      <div>
        <div className="flex justify-between items-start mb-2">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            {room.room_name}
          </h2>
          {/* Admin dzēšanas poga */}
          {isAdmin && (
            <button
              type="button"
              onClick={handleDelete}
              onBlur={() => setConfirmDelete(false)}
              title={confirmDelete ? 'Click again to confirm' : 'Delete room'}
              className={`ml-2 flex-shrink-0 rounded-lg p-1.5 transition ${
                confirmDelete
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'text-zinc-400 hover:bg-red-500/15 hover:text-red-400'
              }`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
        
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Players: {currentPlayers}/{maxPlayers}
        </p>
        
        <p className="text-xs text-zinc-500 mt-1">
          {room.rules.public ? "Public Room" : "Private Room"}
        </p>
        
        {room.rules.rules.length > 0 && (
          <p className="text-xs text-zinc-500 mt-2">
            Rules: {room.rules.rules.join(", ")}
          </p>
        )}

        {typeof room.rules.turn_timeout_seconds === 'number' && (
          <p className="text-xs text-zinc-500 mt-1">
            Turn timeout: {room.rules.turn_timeout_seconds}s
          </p>
        )}
        
        {gameStatus && (
          <p className="text-xs text-zinc-500 mt-1">
            Status: {gameStatus.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => canJoin && router.visit(`/joinroom/${room.id}`)}
        disabled={!canJoin}
        className={`mt-4 w-full px-4 py-2 rounded-xl transition font-medium ${
          canJoin
            ? 'bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer'
            : 'bg-zinc-300 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 cursor-not-allowed'
        }`}
      >
        {canJoin ? 
          (isExistingPlayer ? 'Rejoin Game' : isGamePaused ? 'Join & Resume' : 'Join Room') : 
         isGameActive ? 'Game in Progress' :
         isGameFinished ? 'Game Finished' :
         isRoomFull ? 'Room Full' : 'Cannot Join'
        }
      </button>
    </div>
  );
}
