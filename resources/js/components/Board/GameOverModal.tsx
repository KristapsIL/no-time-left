import React from 'react';

type Player = { id: number; name?: string; role?: string };

type Props = {
  winnerId: number | null | undefined;
  userId: number;
  connectedPlayers: Player[];
  onPlayAgain: () => void;
  onLeave: () => void;
};

// Spēles beigu ekrāns — rāda uzvarētāju un piedāvā spēlēt vēlreiz
export const GameOverModal: React.FC<Props> = ({
  winnerId,
  userId,
  connectedPlayers,
  onPlayAgain,
  onLeave,
}) => {
  const winner = connectedPlayers.find((p) => p.id === winnerId);
  const winnerName = winner?.name ?? (winnerId != null ? `Player ${winnerId}` : null);
  const didWin = winnerId === userId;

  return (
    <div className="absolute inset-0 z-40 bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-zinc-950 text-zinc-100 rounded-2xl p-6 w-full max-w-sm shadow-xl border border-white/10 space-y-5">
        <h2 className="text-2xl font-bold text-center">
          {didWin ? '🎉 You win!' : 'Game over'}
        </h2>

        {!didWin && winnerName && (
          <p className="text-zinc-300 text-center">
            Winner: <span className="font-semibold text-cyan-300">{winnerName}</span>
          </p>
        )}

        <div className="flex flex-wrap gap-2 justify-center">
          <button
            onClick={onPlayAgain}
            className="px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white font-semibold transition"
          >
            Play again
          </button>
          <button
            onClick={onLeave}
            className="px-5 py-2.5 rounded-xl bg-red-700 hover:bg-red-600 text-white font-semibold transition"
          >
            Leave
          </button>
        </div>

        <p className="text-xs text-zinc-500 text-center">
          "Play again" resets the game — go to the lobby to change settings.
        </p>
      </div>
    </div>
  );
};
