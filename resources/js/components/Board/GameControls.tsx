import React from 'react';

type Player = {
  id: number;
  name?: string | null;
  email?: string | null;
};

type Props = {
  roomId: number;
  isStartingGame: boolean;
  connectedPlayers: Player[];
  isChatOpen: boolean;
  toggleChat: () => void;
  leaveGame: () => void;
  startGame: () => void;

  // NEW: pass the current turn from parent
  currentTurn: number | null;
};

export const GameControls = ({
  isStartingGame,
  connectedPlayers,
  isChatOpen,
  toggleChat,
  leaveGame,
  startGame,
  currentTurn,
}: Props) => (
  <div className="absolute bottom-6 left-6 flex gap-3">
    {connectedPlayers.length >= 2 && (
      <button
        onClick={startGame}
        disabled={isStartingGame || currentTurn !== null}
        aria-disabled={isStartingGame || currentTurn !== null}
        className={`px-3 py-2 rounded text-white transition-colors ${
          isStartingGame || currentTurn !== null
            ? 'bg-gray-500 cursor-not-allowed'
            : 'bg-green-500 hover:bg-green-600'
        }`}
      >
        {isStartingGame
          ? 'Starting...'
          : currentTurn !== null
          ? 'Game in progress'
          : 'Start Game'}
      </button>
    )}

    <button
      onClick={leaveGame}
      className="px-3 py-2 rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
    >
      Leave Game
    </button>

    <button
      onClick={toggleChat}
      className={`flex items-center gap-2 px-3 py-2 rounded transition-colors ${
        isChatOpen
          ? 'bg-blue-500 text-white hover:bg-blue-600'
          : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'
      }`}
    >
      {isChatOpen ? 'Close Chat' : 'Open Chat'}
    </button>
  </div>
);
