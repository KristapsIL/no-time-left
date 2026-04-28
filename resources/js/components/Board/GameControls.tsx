import React, { useRef, useEffect, useState } from 'react';
import { LogOut, MessageCircle, X, Menu } from 'lucide-react';

type Props = {
  isChatOpen: boolean;
  toggleChat: () => void;
  leaveGame: () => void;
};

export const GameControls: React.FC<Props> = ({ isChatOpen, toggleChat, leaveGame }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Aizver mobilo menu nospiežot ārpus tā
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <>
      {/* ── Dators: vienmēr redzamas pogas ────────────────────────────── */}
      <div className="hidden md:flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={leaveGame}
          aria-label="Leave Room"
          className="h-11 w-11 rounded-full border border-red-500/30 bg-red-950/80 flex items-center justify-center text-red-300 shadow-lg backdrop-blur-sm transition-colors hover:bg-red-900/80"
        >
          <LogOut className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={toggleChat}
          aria-label={isChatOpen ? 'Close Chat' : 'Open Chat'}
          className={[
            'h-11 w-11 rounded-full border flex items-center justify-center shadow-lg backdrop-blur-sm transition-colors',
            isChatOpen
              ? 'border-cyan-500/40 bg-cyan-950/80 text-cyan-300 hover:bg-cyan-900/80'
              : 'border-sidebar-border/70 bg-sidebar/95 text-sidebar-foreground hover:bg-sidebar-accent',
          ].join(' ')}
        >
          {isChatOpen ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
        </button>
      </div>

      {/* ── Mobilais: FAB kas aizver, kad čats ir atvērts ─────────────── */}
      <div
        ref={ref}
        className={[
          'flex md:hidden flex-row-reverse items-center gap-2 transition-all duration-300',
          isChatOpen ? 'opacity-0 pointer-events-none scale-90' : 'opacity-100',
        ].join(' ')}
      >
        {/* Menu FAB */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          className={[
            'h-12 w-12 rounded-full border shadow-xl flex items-center justify-center flex-shrink-0 transition-all duration-200',
            open
              ? 'bg-zinc-700/90 border-zinc-500/60'
              : 'bg-sidebar/95 border-sidebar-border/70 backdrop-blur-sm',
          ].join(' ')}
        >
          {open
            ? <X className="h-5 w-5 text-white" />
            : <Menu className="h-5 w-5 text-sidebar-foreground" />
          }
        </button>

        {/* Darbību pogas — parādās pa kreisi no FAB */}
        <div
          className={[
            'flex flex-row items-center gap-2 transition-all duration-200 origin-right',
            open
              ? 'opacity-100 scale-x-100 pointer-events-auto'
              : 'opacity-0 scale-x-75 pointer-events-none',
          ].join(' ')}
          aria-hidden={!open}
        >
          <button
            type="button"
            tabIndex={open ? 0 : -1}
            onClick={() => { leaveGame(); setOpen(false); }}
            aria-label="Leave Room"
            className="h-11 w-11 rounded-full border border-red-500/30 bg-red-950/80 flex items-center justify-center text-red-300 shadow-lg backdrop-blur-sm transition-colors hover:bg-red-900/80"
          >
            <LogOut className="h-5 w-5" />
          </button>

          <button
            type="button"
            tabIndex={open ? 0 : -1}
            onClick={() => { toggleChat(); setOpen(false); }}
            aria-label={isChatOpen ? 'Close Chat' : 'Open Chat'}
            className={[
              'h-11 w-11 rounded-full border flex items-center justify-center shadow-lg backdrop-blur-sm transition-colors',
              isChatOpen
                ? 'border-cyan-500/40 bg-cyan-950/80 text-cyan-300 hover:bg-cyan-900/80'
                : 'border-sidebar-border/70 bg-sidebar/95 text-sidebar-foreground hover:bg-sidebar-accent',
            ].join(' ')}
          >
            {isChatOpen ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </>
  );
};
