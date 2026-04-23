import React from 'react';
import { CardView } from '@/components/Board/CardView';

// Augšējā (galda) kārts — rāda pašreizējo kārti uz kuras jāliek
export const TopCard: React.FC<{ topCard: string | null; isPlacing?: boolean }> = ({ topCard, isPlacing = false }) => {
  return (
    <div className="flex items-center justify-center">
      {topCard ? (
        <div className={isPlacing ? 'animate-pulse scale-[1.04] transition-transform duration-500' : ''}>
          <CardView card={topCard} disabled className="w-14 h-20 sm:w-16 sm:h-24" />
        </div>
      ) : (
        <div className="w-14 h-20 sm:w-16 sm:h-24 rounded-lg border border-dashed border-gray-400 flex items-center justify-center text-xs text-gray-500">
          No card
        </div>
      )}
    </div>
  );
};