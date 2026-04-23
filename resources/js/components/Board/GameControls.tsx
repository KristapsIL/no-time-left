import React from 'react';
import { LogOut, MessageCircle, X } from 'lucide-react';

type Props = {
  isChatOpen: boolean;
  toggleChat: () => void;
  leaveGame: () => void;
};

export const GameControls: React.FC<Props> = ({ isChatOpen, toggleChat, leaveGame }) => {
  return (
    <div className="flex flex-col items-stretch gap-2 rounded-xl border border-sidebar-border/70 bg-sidebar/95 p-2 shadow-lg backdrop-blur-sm">
      <button
        type="button"
        onClick={toggleChat}
        className={[
          'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm transition outline-none',
          'ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2',
          isChatOpen ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground',
        ].join(' ')}
      >
        {isChatOpen ? <X className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
        <span>{isChatOpen ? 'Close Chat' : 'Open Chat'}</span>
      </button>

      <button
        type="button"
        onClick={leaveGame}
        className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-red-300 transition outline-none hover:bg-red-500/15 hover:text-red-200 focus-visible:ring-2 focus-visible:ring-red-400/60"
      >
        <LogOut className="h-4 w-4" />
        <span>Leave Room</span>
      </button>
    </div>
  );
};
