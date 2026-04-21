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
    <div className="fixed right-3 bottom-[max(env(safe-area-inset-bottom),12px)] z-40 md:absolute md:left-6 md:right-auto md:bottom-6">
      {/* Main toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="px-4 py-2 rounded-xl bg-neutral-800 text-white hover:bg-neutral-700 transition shadow-lg"
      >
        ☰ Menu
      </button>

      {/* Dropdown panel (opens UP) */}
      {open && (
        <div
          className="absolute bottom-full right-0 mb-2 w-56 bg-white dark:bg-neutral-900 shadow-lg rounded-xl border border-neutral-200 dark:border-neutral-700 z-50 overflow-hidden"
        >
          <ul className="flex flex-col text-sm text-zinc-900 dark:text-zinc-100">
            <li>
              <button
                onClick={() => {
                  startGame();
                  setOpen(false);
                }}
                disabled={isStartingGame || currentTurn !== null}
                className={`w-full text-left px-4 py-2.5 ${
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
            <li>
              <button
                onClick={() => {
                  setOpen(false);
                  leaveGame();
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-red-100 dark:hover:bg-red-800"
              >
                Leave Game
              </button>
            </li>
            <li>
              <button
                onClick={() => {
                  toggleChat();
                  setOpen(false);
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-blue-100 dark:hover:bg-blue-800"
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