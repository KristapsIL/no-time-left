// pages/cardgame/FindRoom.tsx
import AppLayout from '@/layouts/app-layout';
import { Head, router, usePage } from "@inertiajs/react";
import RoomCard from '@/components/FindRoom/RoomCard';
import { useMemo, useState } from 'react';


type Room = {
    id: number;
    room_name: string;
    rules: {
        public: boolean;
        max_players: number;
        turn_timeout_seconds?: number;
        rules: string[];
    };
    game?: {
        game_status: 'waiting' | 'starting' | 'in_progress' | 'finished';
    } | null;
    players?: Array<{ id: number; name: string }> | null;
};

type Props = {
    rooms: Room[];
    auth: {
        user: {
            id: number;
            name: string;
            email: string;
        };
    };
};

export default function FindRoom({ rooms, auth }: Props) {
    const { props } = usePage<{ flash?: { error?: string; success?: string } }>();
    const flashError = props.flash?.error;

    const [query, setQuery] = useState('');
    const [joinCode, setJoinCode] = useState('');
    const [joinError, setJoinError] = useState<string | null>(flashError ?? null);
    const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'private'>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'waiting' | 'starting' | 'in_progress' | 'finished'>('all');
    const [maxPlayersFilter, setMaxPlayersFilter] = useState<'all' | '2' | '3' | '4'>('all');
    const [ruleFilter, setRuleFilter] = useState<string>('all');

    const availableRules = useMemo(() => {
        const rules = new Set<string>();
        for (const room of rooms) {
            for (const rule of room.rules.rules ?? []) {
                if (rule) rules.add(rule);
            }
        }
        return Array.from(rules).sort((a, b) => a.localeCompare(b));
    }, [rooms]);

    const filteredRooms = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();

        return rooms.filter((room) => {
            if (normalizedQuery && !room.room_name.toLowerCase().includes(normalizedQuery)) {
                return false;
            }

            if (visibilityFilter === 'public' && !room.rules.public) return false;
            if (visibilityFilter === 'private' && room.rules.public) return false;

            if (statusFilter !== 'all') {
                const status = room.game?.game_status ?? 'waiting';
                if (status !== statusFilter) return false;
            }

            if (maxPlayersFilter !== 'all' && room.rules.max_players !== Number(maxPlayersFilter)) {
                return false;
            }

            if (ruleFilter !== 'all' && !(room.rules.rules ?? []).includes(ruleFilter)) {
                return false;
            }

            return true;
        });
    }, [rooms, query, visibilityFilter, statusFilter, maxPlayersFilter, ruleFilter]);

    return (
        <AppLayout>
            <Head title="Find a Room" />
            <div className="p-4 md:p-6 space-y-6 min-h-[100dvh]">
                <div className="max-w-6xl mx-auto">
                    <h1 className="text-4xl font-bold mb-2 text-center text-zinc-900 dark:text-zinc-100" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Find a Room</h1>
                    <p className="text-center text-zinc-600 dark:text-zinc-300 mb-8">Join an existing table or jump into a fresh room.</p>

                    {/* Join by code */}
                    <div className="mb-4 rounded-2xl border border-black/10 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
                        <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">Join by room code</p>
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                const code = joinCode.trim().toUpperCase();
                                if (!code) return;
                                setJoinError(null);
                                router.visit(`/joinroom/code/${encodeURIComponent(code)}`);
                            }}
                            className="flex gap-2"
                        >
                            <input
                                type="text"
                                value={joinCode}
                                onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setJoinError(null); }}
                                placeholder="e.g. ABC123"
                                maxLength={8}
                                className="flex-1 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-mono tracking-widest text-zinc-900 outline-none focus:ring-2 focus:ring-cyan-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 uppercase"
                                spellCheck={false}
                                autoComplete="off"
                            />
                            <button
                                type="submit"
                                disabled={!joinCode.trim()}
                                className="px-4 py-2 rounded-xl bg-cyan-600 text-white font-semibold text-sm hover:bg-cyan-500 transition disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Join
                            </button>
                        </form>
                        {joinError && (
                            <p className="mt-2 text-xs text-red-500">{joinError}</p>
                        )}
                    </div>

                    <div className="mb-6 rounded-2xl border border-black/10 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search room name..."
                                className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-cyan-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                            />

                            <select
                                value={visibilityFilter}
                                onChange={(e) => setVisibilityFilter(e.target.value as 'all' | 'public' | 'private')}
                                className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-cyan-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                            >
                                <option value="all">All visibility</option>
                                <option value="public">Public</option>
                                <option value="private">Private</option>
                            </select>

                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'waiting' | 'starting' | 'in_progress' | 'finished')}
                                className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-cyan-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                            >
                                <option value="all">All statuses</option>
                                <option value="waiting">Waiting</option>
                                <option value="starting">Starting</option>
                                <option value="in_progress">In progress</option>
                                <option value="finished">Finished</option>
                            </select>

                            <select
                                value={maxPlayersFilter}
                                onChange={(e) => setMaxPlayersFilter(e.target.value as 'all' | '2' | '3' | '4')}
                                className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-cyan-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                            >
                                <option value="all">All sizes</option>
                                <option value="2">2 players</option>
                                <option value="3">3 players</option>
                                <option value="4">4 players</option>
                            </select>

                            <select
                                value={ruleFilter}
                                onChange={(e) => setRuleFilter(e.target.value)}
                                className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-cyan-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                            >
                                <option value="all">All rules</option>
                                {availableRules.map((rule) => (
                                    <option key={rule} value={rule}>
                                        {rule.replaceAll('_', ' ')}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="mt-3 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                            <p>{filteredRooms.length} room{filteredRooms.length === 1 ? '' : 's'} match your filters</p>
                            <button
                                type="button"
                                onClick={() => {
                                    setQuery('');
                                    setVisibilityFilter('all');
                                    setStatusFilter('all');
                                    setMaxPlayersFilter('all');
                                    setRuleFilter('all');
                                }}
                                className="rounded-md border border-zinc-300 px-2 py-1 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                            >
                                Clear filters
                            </button>
                        </div>
                    </div>

                    {filteredRooms.length === 0 ? (
                        <div className="text-center py-12 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5">
                            <div className="text-6xl mb-4">🎮</div>
                            <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">No matching rooms</h3>
                            <p className="text-zinc-600 dark:text-zinc-300 mb-6">Try adjusting your filters or create a new room.</p>
                            <button 
                                onClick={() => router.visit('/createRoom')}
                                className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
                            >
                                Create Room
                            </button>
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {filteredRooms.map((room) => (
                            <RoomCard key={room.id} room={room} currentUserId={auth.user.id} />
                        ))}
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
