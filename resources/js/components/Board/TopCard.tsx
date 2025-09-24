import React from 'react';

type Props = {
  topCard: string | null;
};

export const TopCard = ({ topCard }: Props) => (
  <div className="relative w-20 h-28">
    {topCard ? (
      <div className="absolute w-full h-full rounded-lg bg-white border shadow-lg flex items-center justify-center text-xl text-black font-bold">
        {topCard}
      </div>
    ) : (
      <div className="absolute w-full h-full rounded-lg bg-neutral-800 border shadow-md flex items-center justify-center text-black text-2xl">
        🂠
      </div>
    )}
  </div>
);
