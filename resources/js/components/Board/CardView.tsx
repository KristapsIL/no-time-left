import React from 'react';
import { parseCard } from '@/utils/parseCard';

type Props = {
  card: string;
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
  className?: string;
};

// Simple fallback for any temporary placeholder values
function isPlaceholder(c: string) {
  return typeof c === 'string' && c.startsWith('loading_card_');
}

export const CardView: React.FC<Props> = ({ card, onClick, disabled, selected, className }) => {
  if (isPlaceholder(card)) {
    return (
      <div
        className={[
          'w-14 h-20 rounded-lg border border-gray-300 bg-gray-200 animate-pulse',
          'shadow-sm',
          className || '',
        ].join(' ')}
        aria-hidden="true"
      />
    );
  }

  const parsed = parseCard(card);
  if (!parsed) {
    // unknown format: render a neutral tile so it doesn't look broken
    return (
      <div
        className={[
          'w-14 h-20 rounded-lg border border-gray-300 bg-white',
          'flex items-center justify-center text-xs text-gray-500',
          className || '',
        ].join(' ')}
        title={String(card)}
      >
        {String(card)}
      </div>
    );
  }

  const { rank, suit, color } = parsed;
  const colorClass = color === 'red' ? 'text-red-600' : 'text-gray-900';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'w-14 h-20 rounded-lg border bg-white shadow-sm relative',
        'transition-transform',
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-1',
        selected ? 'ring-2 ring-amber-400' : '',
        colorClass,
        className || '',
      ].join(' ')}
      title={`${rank}${suit}`}
      aria-label={`${rank}${suit}`}
    >
      {/* Rank + suit top-left */}
      <div className="absolute top-1 left-1 leading-none text-sm font-semibold">
        <div>{rank}</div>
        <div>{suit}</div>
      </div>

      {/* Big suit centered */}
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-2xl">{suit}</div>
      </div>

      {/* Rank + suit bottom-right (mirrored) */}
      <div className="absolute bottom-1 right-1 leading-none text-sm font-semibold rotate-180">
        <div>{rank}</div>
        <div>{suit}</div>
      </div>
    </button>
  );
};