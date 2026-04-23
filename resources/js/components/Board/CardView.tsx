import React from 'react';
import { parseCard } from '@/utils/parseCard';

type CardViewProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  card: string;
  selected?: boolean;
  showPlusTwoLabel?: boolean;
};

function isPlaceholder(c: string) {
  return typeof c === 'string' && c.startsWith('loading_card_');
}

// Vienas kārts vizuālais attēlojums — noklikšķināma poga ar vērtību un uzvalku
export const CardView: React.FC<CardViewProps> = ({
  card,
  selected,
  className,
  disabled,
  onClick,
  style,
  showPlusTwoLabel,
  ...rest
}) => {
  if (isPlaceholder(card)) {
    // Ielādes vietāturājs — nav interaktīvs
    return (
      <div
        className={[
          'w-14 h-20 rounded-lg border border-gray-300 bg-gray-200 animate-pulse',
          'shadow-sm',
          className || '',
        ].join(' ')}
        style={style}
        aria-hidden="true"
      />
    );
  }

  const parsed = parseCard(card);
  if (!parsed) {
    // Nezināms formāts — neitrāla plāksne
    return (
      <div
        className={[
          'w-14 h-20 rounded-lg border border-gray-300 bg-white',
          'flex items-center justify-center text-xs text-gray-500',
          className || '',
        ].join(' ')}
        style={style}
        title={String(card)}
      >
        {String(card)}
      </div>
    );
  }

  const { rank, suit, color } = parsed;
  const colorClass = color === 'red' ? 'text-red-600' : 'text-gray-900';

  const base = [
    'w-14 h-20 rounded-lg border bg-white shadow-sm relative',
    'transition-transform',
    disabled ? 'cursor-not-allowed' : 'hover:-translate-y-1',
    selected ? 'ring-2 ring-amber-400' : '',
    colorClass,
    className || '',
  ].join(' ');

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={base}
      style={style}
      title={`${rank}${suit}`}
      aria-label={`${rank}${suit}`}
      {...rest} // allow caller to override aria, tabIndex, handlers, etc.
    >
      {/* Rangs + zīme augšā pa kreisi */}
      <div className="absolute top-1 left-1 leading-none text-sm font-semibold">
        <div>{rank}</div>
        <div>{suit}</div>
      </div>

      {/* Liela zīme centrā */}
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-2xl">{suit}</div>
      </div>

      {/* +2 nozīmīte ja noteikums ir aktīvs */}
      {showPlusTwoLabel && rank === '2' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-xs font-bold bg-amber-400 text-zinc-900 rounded px-1 leading-tight shadow">
            +2
          </span>
        </div>
      )}

      {/* Rangs + zīme apakšā pa labi (apgriezts) */}
      <div className="absolute bottom-1 right-1 leading-none text-sm font-semibold rotate-180">
        <div>{rank}</div>
        <div>{suit}</div>
      </div>
    </button>
  );
};