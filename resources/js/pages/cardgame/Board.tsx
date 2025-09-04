import React from 'react';
import { Head, router } from '@inertiajs/react';

type Props = { deck: string[]};

function Board({ deck }: Props){
    return (
    <>
      <Head title="Board" />
      <div className="p-6 space-y-4">
        <div className="flex gap-2">
          <button
            className="px-3 py-1 rounded bg-indigo-600 text-white"
            onClick={() => router.post('/board/shuffle')}>
            Shuffle
          </button>
        <button
            className="px-3 py-1 rounded bg-red-500"
            onClick={() => router.post('/board/reset')}>
            Reset (new unshuffled deck)
          </button>
        </div>

        <ul className="flex gap-2 flex-wrap">
          {deck.map((c) => (
            <li key={c} className="px-2 py-1 border rounded">{c}</li>
          ))}
        </ul>
    </div>
    </>

    );
};
export default Board;