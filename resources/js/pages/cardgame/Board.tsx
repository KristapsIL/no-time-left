import React from 'react';
import { Head, router } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';

type Props = { 
    room: { id: number; code: string; rules: string[] };
    deck: string[];
};

function Board({ room, deck }: Props){
    return (
    <AppLayout>
        <Head title="Board" />
        <div className="p-6 space-y-4">
            <div className="flex gap-2">
                <button
                    className="px-3 py-1 rounded bg-lime-500 text-white"
                    onClick={() => router.post(`/board/${room.id}/shuffle`)}>
                    Shuffle
                </button>
            </div>

            <div className="flex gap-2 flex-wrap">
            {deck.map((card) => (
                <div key={card} className="px-2 py-1 border rounded">{card}</div>
            ))}
            </div>
        </div>
    </AppLayout>
    );
};
export default Board;