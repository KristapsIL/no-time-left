import { router } from "@inertiajs/react";

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

export default function RoomCard({ room, currentUserId }: { room: Room; currentUserId?: number }) {
  const currentPlayers = room.players?.length || 0;
  const maxPlayers = room.rules.max_players;
  const gameStatus = room.game?.game_status;
  const isRoomFull = currentPlayers >= maxPlayers;
  const isGameActive = gameStatus === 'starting' || gameStatus === 'in_progress';
  const isGameFinished = gameStatus === 'finished';
  const isExistingPlayer = currentUserId && room.players?.some(player => player.id === currentUserId);
  const canJoin = isExistingPlayer || (!isRoomFull && !isGameActive && !isGameFinished);

  const getStatusText = () => {
    if (isExistingPlayer && isGameActive) return 'Your Game - In Progress';
    if (isExistingPlayer && isGameFinished) return 'Your Game - Finished';
    if (isGameActive) return 'Game in Progress';
    if (isGameFinished) return 'Game Finished';
    if (isRoomFull) return 'Room Full';
    if (gameStatus === 'waiting') return `Waiting (${currentPlayers}/${maxPlayers})`;
    return `Available (${currentPlayers}/${maxPlayers})`;
  };


  return (
    <div className={`rounded-xl border bg-white dark:bg-neutral-900 shadow hover:shadow-lg transition p-4 flex flex-col justify-between ${
      isExistingPlayer 
        ? 'border-blue-300 dark:border-blue-600 ring-1 ring-blue-100 dark:ring-blue-900' :
      canJoin 
        ? 'border-gray-200 dark:border-gray-700' 
        : 'border-gray-300 dark:border-gray-600 opacity-75'
    }`}>
      <div>
        <div className="flex justify-between items-start mb-2">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            {room.room_name}
          </h2>
        </div>
        
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Players: {currentPlayers}/{maxPlayers}
        </p>
        
        <p className="text-xs text-gray-400 mt-1">
          {room.rules.public ? "Public Room" : "Private Room"}
        </p>
        
        {room.rules.rules.length > 0 && (
          <p className="text-xs text-gray-500 mt-2">
            Rules: {room.rules.rules.join(", ")}
          </p>
        )}
        
        {gameStatus && (
          <p className="text-xs text-gray-400 mt-1">
            Status: {gameStatus.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => canJoin && router.visit(`/joinroom/${room.id}`)}
        disabled={!canJoin}
        className={`mt-4 w-full px-4 py-2 rounded-lg transition font-medium ${
          canJoin
            ? 'bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer'
            : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
        }`}
      >
        {canJoin ? 
          (isExistingPlayer ? 'Rejoin Game' : 'Join Room') : 
         isGameActive ? 'Game in Progress' :
         isGameFinished ? 'Game Finished' :
         isRoomFull ? 'Room Full' : 'Cannot Join'
        }
      </button>
    </div>
  );
}
