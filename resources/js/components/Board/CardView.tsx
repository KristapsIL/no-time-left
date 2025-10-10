// src/components/Board/CardView.tsx
import React, { memo, useMemo } from 'react';

type CardViewProps = {
  card?: string;            // e.g. 'AS', '10H'; optional if faceDown
  disabled?: boolean;
  onClick?: () => void;
  faceDown?: boolean;
  className?: string;
  title?: string;
  size?: 'sm' | 'md' | 'lg'; // affects width/height
  highlight?: boolean;       // show playable glow
};

type ParsedCard = {
  rank: string;
  suit: 'S' | 'H' | 'D' | 'C';
  color: 'red' | 'black';
};

const parseCard = (card: string): ParsedCard => {
  // Accepts '10H', 'AS', 'KD', '7C'
  const m = card.match(/^([2-9]|10|[JQKA])([SHDC])$/i);
  if (!m) throw new Error(`Invalid card: ${card}`);
  const rank = m[1].toUpperCase();
  const suit = m[2].toUpperCase() as ParsedCard['suit'];
  const color: ParsedCard['color'] = suit === 'H' || suit === 'D' ? 'red' : 'black';
  return { rank, suit, color };
};

const suitPath = (suit: ParsedCard['suit']) => {
  switch (suit) {
    case 'S': // spade
      return (
        <path d="M50 10 C35 30,20 45,50 70 C80 45,65 30,50 10 Z M40 72 Q50 80 60 72 C55 85 45 85 40 72 Z" />
      );
    case 'H': // heart
      return (
        <path d="M50 78 C20 58,10 40,25 25 C35 15,50 20,50 32 C50 20,65 15,75 25 C90 40,80 58,50 78 Z" />
      );
    case 'D': // diamond
      return (
        <path d="M50 10 L75 45 L50 80 L25 45 Z" />
      );
    case 'C': // club
      return (
        <>
          <circle cx="40" cy="38" r="12" />
          <circle cx="60" cy="38" r="12" />
          <circle cx="50" cy="25" r="12" />
          <path d="M46 40 Q50 50 54 40 L54 65 L46 65 Z" />
        </>
      );
  }
};

const SUIT_LABEL: Record<ParsedCard['suit'], string> = {
  S: '♠',
  H: '♥',
  D: '♦',
  C: '♣',
};

export const CardView = memo(function CardView({
  card,
  disabled,
  onClick,
  faceDown,
  className = '',
  title,
  size = 'md',
  highlight,
}: CardViewProps) {
  const parsed = useMemo(() => (card && !faceDown ? parseCard(card) : null), [card, faceDown]);

  const sizeClass = {
    sm: 'w-[48px] h-[68px]',
    md: 'w-[64px] h-[92px]',
    lg: 'w-[84px] h-[120px]',
  }[size];

  const isDisabled = !!disabled;

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={onClick}
      className={[
        'relative select-none rounded-lg shadow-md border border-black/10 overflow-hidden',
        'transition-transform duration-150 will-change-transform',
        isDisabled ? 'cursor-not-allowed opacity-60' : 'hover:-translate-y-1 active:translate-y-0.5',
        highlight ? 'ring-2 ring-yellow-300 ring-offset-2 ring-offset-emerald-800' : '',
        sizeClass,
        className,
      ].join(' ')}
      title={title}
      aria-label={title || (card ? `${card} card` : faceDown ? 'Card back' : 'Card')}
    >
      {/* Card background */}
      <div className="absolute inset-0 bg-white" />

      {/* Face-down pattern */}
      {faceDown && (
        <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,#14532d,#14532d_6px,#0f3f20_6px,#0f3f20_12px)]" />
      )}

      {/* Face-up content */}
      {!faceDown && parsed && (
        <>
          <div className="absolute inset-0 p-1 flex flex-col">
            <div
              className={[
                'text-xs font-bold',
                parsed.color === 'red' ? 'text-red-600' : 'text-gray-900',
              ].join(' ')}
            >
              <div>{parsed.rank}</div>
              <div>{SUIT_LABEL[parsed.suit]}</div>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <svg viewBox="0 0 100 100" className="w-[70%] h-[70%]"
                   aria-hidden="true" focusable="false"
                   fill={parsed.color === 'red' ? '#dc2626' : '#111827'}>
                {suitPath(parsed.suit)}
              </svg>
            </div>
            <div
              className={[
                'text-xs font-bold self-end rotate-180',
                parsed.color === 'red' ? 'text-red-600' : 'text-gray-900',
              ].join(' ')}
            >
              <div>{parsed.rank}</div>
              <div>{SUIT_LABEL[parsed.suit]}</div>
            </div>
          </div>
        </>
      )}

      {/* Gloss */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
    </button>
  );
});