import React, { useState, useRef, useEffect } from 'react';

type Props = {
  isChatOpen: boolean;
  toggleChat: () => void;
  leaveGame: () => void;
};

export const GameControls: React.FC<Props> = ({ isChatOpen, toggleChat, leaveGame }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close popout when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  return (
    <div className="flex items-center justify-end w-full max-w-5xl px-2 gap-2">
      {/* Desktop: full buttons */}
      <button
        type="button"
        onClick={toggleChat}
        className="hidden md:inline-flex px-3 py-1.5 rounded-lg bg-neutral-700/80 text-white text-sm hover:bg-neutral-600 transition"
      >
        {isChatOpen ? '✕ Chat' : '💬 Chat'}
      </button>
      <button
        type="button"
        onClick={leaveGame}
        className="hidden md:inline-flex px-3 py-1.5 rounded-lg bg-red-900/60 text-red-200 text-sm hover:bg-red-800/80 transition"
      >
        Leave
      </button>

      {/* Mobile: ⋮ popout */}
      <div ref={menuRef} className="md:hidden relative">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="px-3 py-1.5 rounded-lg bg-neutral-700/80 text-white text-sm hover:bg-neutral-600 transition"
          aria-label="Game menu"
        >
          ⋮
        </button>
        {menuOpen && (
          <div className="absolute bottom-full mb-2 right-0 z-50 flex flex-col gap-1 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl p-2 min-w-[120px]">
            <button
              type="button"
              onClick={() => { toggleChat(); setMenuOpen(false); }}
              className="px-3 py-2 rounded-lg bg-neutral-700/80 text-white text-sm hover:bg-neutral-600 transition text-left"
            >
              {isChatOpen ? '✕ Close Chat' : '💬 Chat'}
            </button>
            <button
              type="button"
              onClick={() => { setMenuOpen(false); leaveGame(); }}
              className="px-3 py-2 rounded-lg bg-red-900/60 text-red-200 text-sm hover:bg-red-800/80 transition text-left"
            >
              🚪 Leave
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
