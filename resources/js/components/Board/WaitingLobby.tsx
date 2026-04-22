import React from 'react';

type Player = { id: number; name?: string; role?: string };

type Props = {
  players: Player[];
  userId: number;
  isCreator: boolean;
  isStartingGame: boolean;
  roomCode: string;
  onStart: () => void;
  onLeave: () => void;
};

export const WaitingLobby: React.FC<Props> = ({
  players,
  userId,
  isCreator,
  isStartingGame,
  roomCode,
  onStart,
  onLeave,
}) => {
  const humanPlayers = players.filter((p) => p.role !== 'bot');

  return (
    <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-950 border border-white/10 rounded-2xl p-6 w-full max-w-sm text-zinc-100 space-y-5 shadow-2xl">
        {/* Room code */}
        <div className="text-center">
          <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Room Code</p>
          <code className="text-3xl font-mono font-bold tracking-widest text-cyan-400">{roomCode}</code>
        </div>

        {/* Player list */}
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">
            Players ({humanPlayers.length})
          </p>
          <ul className="space-y-1.5">
            {humanPlayers.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/5"
              >
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    p.id === userId ? 'bg-cyan-400' : 'bg-zinc-500'
                  }`}
                />
                <span className="text-sm truncate">{p.name ?? `Player ${p.id}`}</span>
                {p.id === userId && (
                  <span className="ml-auto text-[10px] text-cyan-400 font-semibold uppercase tracking-wide flex-shrink-0">
                    You
                  </span>
                )}
              </li>
            ))}
            {humanPlayers.length === 0 && (
              <li className="text-zinc-500 text-sm text-center py-2">No players yet…</li>
            )}
          </ul>
        </div>

        {/* Start / waiting */}
        {isCreator ? (
          <button
            type="button"
            onClick={onStart}
            disabled={isStartingGame}
            className="w-full py-3 rounded-xl bg-green-500 text-white font-bold text-base hover:bg-green-400 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-900/40"
          >
            {isStartingGame ? 'Starting…' : '▶ Start Game'}
          </button>
        ) : (
          <div className="text-center py-2 text-zinc-400 text-sm">
            Waiting for the host to start…
          </div>
        )}

        {/* Leave */}
        <button
          type="button"
          onClick={onLeave}
          className="w-full py-2 rounded-xl bg-zinc-800 text-zinc-400 text-sm hover:bg-zinc-700 hover:text-zinc-200 transition"
        >
          Leave Room
        </button>
      </div>
    </div>
  );
};
