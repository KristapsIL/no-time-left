import React from 'react';

type Props = {
  isChatOpen: boolean;
  toggleChat: () => void;
  leaveGame: () => void;
};

export const GameControls: React.FC<Props> = ({ isChatOpen, toggleChat, leaveGame }) => (
  <div className="flex items-center justify-end gap-2 w-full max-w-5xl px-2">
    <button
      type="button"
      onClick={toggleChat}
      className="px-3 py-1.5 rounded-lg bg-neutral-700/80 text-white text-sm hover:bg-neutral-600 transition"
    >
      {isChatOpen ? '✕ Chat' : '💬 Chat'}
    </button>
    <button
      type="button"
      onClick={leaveGame}
      className="px-3 py-1.5 rounded-lg bg-red-900/60 text-red-200 text-sm hover:bg-red-800/80 transition"
    >
      Leave
    </button>
  </div>
);
