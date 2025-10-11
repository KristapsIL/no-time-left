import React from 'react';
import { CardView } from '@/components/Board/CardView';

export const TopCard: React.FC<{ topCard: string | null }> = ({ topCard }) => {
  return (
    <div className="flex items-center justify-center">
      {topCard ? (
        <CardView card={topCard} disabled className="w-16 h-24" />
      ) : (
        <div className="w-16 h-24 rounded-lg border border-dashed border-gray-400 flex items-center justify-center text-xs text-gray-500">
          No card
        </div>
      )}
    </div>
  );
};