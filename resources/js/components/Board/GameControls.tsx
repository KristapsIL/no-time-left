import React, { useState } from 'react';

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
  currentTurn: number | null;
};

export const GameControls: React.FC<Props> = ({
  isStartingGame,
  connectedPlayers,
  isChatOpen,
  toggleChat,
  leaveGame,
  startGame,
  currentTurn,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute bottom-6 left-6">
      {/* Main toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="px-4 py-2 rounded bg-neutral-800 text-white hover:bg-neutral-700 transition"
      >
        ☰ Menu
      </button>

      {/* Dropdown panel (opens UP) */}
      {open && (
        <div
          className="absolute bottom-full mb-2 w-48 bg-white dark:bg-neutral-900 shadow-lg rounded border border-neutral-200 dark:border-neutral-700 z-50"
        >
          <ul className="flex flex-col">
            {connectedPlayers.length >= 2 && (
              <li>
                <button
                  onClick={startGame}
                  disabled={isStartingGame || currentTurn !== null}
                  className={`w-full text-left px-4 py-2 ${
                    isStartingGame || currentTurn !== null
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'hover:bg-green-100 dark:hover:bg-green-800'
                  }`}
                >
                  {isStartingGame
                    ? 'Starting...'
                    : currentTurn !== null
                    ? 'Game in progress'
                    : 'Start Game'}
                </button>
              </li>
            )}
            <li>
              <button
                onClick={leaveGame}
                className="w-full text-left px-4 py-2 hover:bg-red-100 dark:hover:bg-red-800"
              >
                Leave Game
              </button>
            </li>
            <li>
              <button
                onClick={toggleChat}
                className="w-full text-left px-4 py-2 hover:bg-blue-100 dark:hover:bg-blue-800"
              >
                {isChatOpen ? 'Close Chat' : 'Open Chat'}
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};