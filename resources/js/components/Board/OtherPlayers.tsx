import React from 'react';

type Props = {
  players: any[];
  handCounts: Record<string, number>;
  currentTurn: number | null;
  userId: number;
};

export const OtherPlayers = ({ players, handCounts, currentTurn, userId }: Props) => {
  const others = players.filter(p => (p.id ?? p.user_id) !== userId);
  return (
    <div className="flex justify-center gap-8 mb-4 flex-wrap">
      {others.map(player => {
        const pid = String(player.id ?? player.user_id);
        const count = handCounts[pid] ?? 0;
        const isTheirTurn = currentTurn === (player.id ?? player.user_id);
        return (
          <div key={pid} className="flex flex-col items-center">
            <div className={`text-white text-sm mb-1 ${isTheirTurn ? 'font-bold' : ''}`}>
              {player.name ?? `Player ${pid}`} {isTheirTurn && <span className="ml-1 text-yellow-300 animate-pulse">(turn)</span>}
            </div>
            <div className="flex gap-1">
              {Array.from({ length: count }).map((_, i) => (
                <div key={i} className={`w-10 h-14 rounded shadow-md border
                                        ${isTheirTurn ? 'bg-red-700 ring-2 ring-yellow-300' : 'bg-red-600'}`} />
              ))}
              {count === 0 && <div className="text-white/70 text-xs italic">no cards</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
};
