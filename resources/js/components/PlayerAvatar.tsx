import React from 'react';

const PALETTE = [
  '#0ea5e9', // sky
  '#8b5cf6', // violet
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
];

export const PlayerAvatar: React.FC<{
  id: number | string;
  name?: string;
  size?: number;
  className?: string;
  avatarUrl?: string | null;
}> = ({ id, name, size = 28, className = '', avatarUrl }) => {
  const numId = typeof id === 'number' ? id : parseInt(String(id), 10) || 0;
  const color = PALETTE[Math.abs(numId) % PALETTE.length];

  const initials = (name ?? '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '?';

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name ?? 'Player'}
        className={`rounded-full object-cover flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}
        aria-label={name ?? 'Player'}
      />
    );
  }

  return (
    <div
      className={`rounded-full flex items-center justify-center flex-shrink-0 font-bold select-none ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        color: '#fff',
        fontSize: Math.max(9, Math.round(size * 0.38)),
        letterSpacing: '-0.02em',
      }}
      aria-label={name ?? 'Player'}
    >
      {initials}
    </div>
  );
};
