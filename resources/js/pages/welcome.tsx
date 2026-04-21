import { dashboard, login, register } from '@/routes';
import { type SharedData } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { useCallback, useEffect, useMemo, useState } from 'react';

type DemoTurn = 'player' | 'bot';

type DemoState = {
    playerHand: string[];
    botHand: string[];
    topCard: string;
    deck: string[];
    turn: DemoTurn;
    status: 'in_progress' | 'finished';
    winner: DemoTurn | null;
    note: string;
};

const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const cardColor = (suit: string) => (suit === '♥' || suit === '♦' ? 'text-rose-600' : 'text-zinc-900');

const parseCard = (card: string): { value: string; suit: string } => {
    const [value = '', suit = ''] = card.split('-');
    return { value, suit };
};

const shuffle = <T,>(arr: T[]): T[] => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
};

const canPlay = (card: string, topCard: string) => {
    const c = parseCard(card);
    const t = parseCard(topCard);
    return c.suit === t.suit || c.value === t.value;
};

const drawUntilPlayable = (hand: string[], deck: string[], topCard: string): { hand: string[]; deck: string[] } => {
    let nextHand = [...hand];
    let nextDeck = [...deck];

    while (nextDeck.length > 0 && !nextHand.some((c) => canPlay(c, topCard))) {
        const drawn = nextDeck.pop();
        if (!drawn) break;
        nextHand.push(drawn);
    }

    return { hand: nextHand, deck: nextDeck };
};

const createDemoState = (): DemoState => {
    const deck = shuffle(VALUES.flatMap((value) => SUITS.map((suit) => `${value}-${suit}`)));
    const playerHand = deck.splice(0, 5);
    const botHand = deck.splice(0, 5);
    const topCard = deck.pop() ?? 'A-♣';

    return {
        playerHand,
        botHand,
        topCard,
        deck,
        turn: 'player',
        status: 'in_progress',
        winner: null,
        note: 'Play a matching card to start the mini game.',
    };
};

export default function Welcome() {
    const { auth } = usePage<SharedData>().props;
    const [demo, setDemo] = useState<DemoState>(() => createDemoState());

    const resetDemo = useCallback(() => {
        setDemo(createDemoState());
    }, []);

    const playDemoCard = useCallback((card: string) => {
        setDemo((prev) => {
            if (prev.status !== 'in_progress' || prev.turn !== 'player') return prev;
            if (!canPlay(card, prev.topCard)) {
                return { ...prev, note: 'Invalid move. Match suit or value.' };
            }

            const cardIndex = prev.playerHand.indexOf(card);
            const nextHand = prev.playerHand.filter((_, i) => i !== cardIndex);

            if (nextHand.length === 0) {
                return {
                    ...prev,
                    playerHand: [],
                    topCard: card,
                    status: 'finished',
                    winner: 'player',
                    note: 'You won the demo round. Reset to play again.',
                };
            }

            return {
                ...prev,
                playerHand: nextHand,
                topCard: card,
                turn: 'bot',
                note: 'Bot is thinking...',
            };
        });
    }, []);

    const drawForPlayer = useCallback(() => {
        setDemo((prev) => {
            if (prev.status !== 'in_progress' || prev.turn !== 'player') return prev;
            const drawn = prev.deck[prev.deck.length - 1];
            if (!drawn) return { ...prev, note: 'Deck is empty.' };

            return {
                ...prev,
                deck: prev.deck.slice(0, -1),
                playerHand: [...prev.playerHand, drawn],
                note: `You drew ${drawn.replace('-', ' ')}.`,
            };
        });
    }, []);

    useEffect(() => {
        if (demo.status !== 'in_progress' || demo.turn !== 'bot') return;

        const timeout = window.setTimeout(() => {
            setDemo((prev) => {
                if (prev.status !== 'in_progress' || prev.turn !== 'bot') return prev;

                const withDraw = drawUntilPlayable(prev.botHand, prev.deck, prev.topCard);
                const playableCard = withDraw.hand.find((c) => canPlay(c, prev.topCard));

                if (!playableCard) {
                    return {
                        ...prev,
                        botHand: withDraw.hand,
                        deck: withDraw.deck,
                        turn: 'player',
                        note: 'Bot passed. Your turn.',
                    };
                }

                const cardIndex = withDraw.hand.indexOf(playableCard);
                const nextBotHand = withDraw.hand.filter((_, i) => i !== cardIndex);

                if (nextBotHand.length === 0) {
                    return {
                        ...prev,
                        botHand: [],
                        deck: withDraw.deck,
                        topCard: playableCard,
                        status: 'finished',
                        winner: 'bot',
                        note: `Bot played ${playableCard.replace('-', ' ')} and won.`,
                    };
                }

                return {
                    ...prev,
                    botHand: nextBotHand,
                    deck: withDraw.deck,
                    topCard: playableCard,
                    turn: 'player',
                    note: `Bot played ${playableCard.replace('-', ' ')}. Your turn.`,
                };
            });
        }, 900);

        return () => window.clearTimeout(timeout);
    }, [demo.status, demo.turn]);

    const topCard = useMemo(() => parseCard(demo.topCard), [demo.topCard]);
    const previewBotCard = useMemo(() => parseCard(demo.botHand[0] ?? 'A-♣'), [demo.botHand]);

    return (
        <>
            <Head title="No Time Left">
                <link rel="preconnect" href="https://fonts.bunny.net" />
                <link href="https://fonts.bunny.net/css?family=manrope:400,500,700,800|space-grotesk:500,700" rel="stylesheet" />
            </Head>

            <div
                className="relative min-h-screen overflow-hidden bg-[#f8f4ec] text-[#18181b] transition-colors dark:bg-[#070b10] dark:text-[#f5f7ff]"
                style={{ fontFamily: 'Manrope, sans-serif' }}
            >
                <div className="pointer-events-none absolute inset-0">
                    <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-[#f97316]/20 blur-3xl dark:bg-[#22d3ee]/10" />
                    <div className="absolute right-[-60px] top-1/4 h-80 w-80 rounded-full bg-[#22d3ee]/15 blur-3xl dark:bg-[#34d399]/10" />
                    <div className="absolute bottom-[-80px] left-1/3 h-80 w-80 rounded-full bg-[#eab308]/15 blur-3xl dark:bg-[#a78bfa]/10" />
                    <div
                        className="absolute inset-0 opacity-[0.06] dark:opacity-[0.08]"
                        style={{
                            backgroundImage:
                                'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
                            backgroundSize: '42px 42px',
                        }}
                    />
                </div>

                <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 text-sm md:px-8">
                    <h1 className="text-xl font-extrabold tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                        No Time Left
                    </h1>
                    <nav className="flex items-center gap-4">
                        {auth.user ? (
                            <Link
                                href={dashboard()}
                                className="rounded-full border border-black/15 bg-white/70 px-5 py-2 font-medium text-zinc-900 transition hover:-translate-y-0.5 hover:bg-white dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                            >
                                Dashboard
                            </Link>
                        ) : (
                            <>
                                <Link
                                    href={login()}
                                    className="rounded-full px-4 py-2 font-medium text-zinc-700 transition hover:bg-white/70 dark:text-zinc-200 dark:hover:bg-white/10"
                                >
                                    Log in
                                </Link>
                                <Link
                                    href={register()}
                                    className="rounded-full border border-black/15 bg-white/70 px-5 py-2 font-medium text-zinc-900 transition hover:-translate-y-0.5 hover:bg-white dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                                >
                                    Register
                                </Link>
                            </>
                        )}
                    </nav>
                </header>

                <main className="relative mx-auto w-full max-w-6xl px-6 pb-14 md:px-8">
                    <section className="grid items-start gap-10 pb-12 pt-6 md:grid-cols-[1.05fr_0.95fr]">
                        <div className="space-y-6 text-left">
                            <p className="inline-flex items-center rounded-full border border-black/10 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-700 dark:border-white/15 dark:bg-white/10 dark:text-zinc-200">
                                Real-time Room Card Game
                            </p>

                            <h2
                                className="text-4xl font-extrabold leading-tight text-zinc-900 md:text-6xl dark:text-zinc-100"
                                style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                            >
                                Tension at
                                <br />
                                card-table speed.
                            </h2>

                            <p className="max-w-xl text-lg leading-relaxed text-zinc-700 dark:text-zinc-300">
                                Match suit or value, manage your turn timer, and race your hand to zero. Try the live mini board on
                                the right now, then jump into full rooms below.
                            </p>

                            <div className="grid max-w-xl gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                                <p>• On your turn: play a valid card or pick up.</p>
                                <p>• Time expires: the game can force your turn forward.</p>
                                <p>• First player with an empty hand wins.</p>
                            </div>

                            <div className="flex flex-col gap-3 sm:flex-row">
                                {auth.user ? (
                                    <>
                                        <Link
                                            href="/quick-ai-room"
                                            method="post"
                                            as="button"
                                            className="inline-flex items-center justify-center rounded-2xl bg-zinc-900 px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:bg-black dark:bg-cyan-400 dark:text-zinc-900 dark:hover:bg-cyan-300"
                                        >
                                            Play vs AI
                                        </Link>
                                        <Link
                                            href={dashboard()}
                                            className="inline-flex items-center justify-center rounded-2xl border border-black/20 bg-white px-7 py-3 text-sm font-semibold text-zinc-800 transition hover:-translate-y-0.5 hover:border-black/40 dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                                        >
                                            Continue to Dashboard
                                        </Link>
                                    </>
                                ) : (
                                    <>
                                        <Link
                                            href={register()}
                                            className="inline-flex items-center justify-center rounded-2xl bg-zinc-900 px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:bg-black dark:bg-cyan-400 dark:text-zinc-900 dark:hover:bg-cyan-300"
                                        >
                                            Start Playing
                                        </Link>
                                        <Link
                                            href={login()}
                                            className="inline-flex items-center justify-center rounded-2xl border border-black/20 bg-white px-7 py-3 text-sm font-semibold text-zinc-800 transition hover:-translate-y-0.5 hover:border-black/40 dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                                        >
                                            Log In
                                        </Link>
                                    </>
                                )}
                            </div>

                            <div className="grid max-w-xl grid-cols-3 gap-3 pt-3 text-sm">
                                <div className="rounded-xl border border-black/10 bg-white/80 p-3 dark:border-white/10 dark:bg-white/10">
                                    <p className="font-semibold text-zinc-900 dark:text-zinc-100">2-4 Players</p>
                                    <p className="text-zinc-600 dark:text-zinc-300">Per room</p>
                                </div>
                                <div className="rounded-xl border border-black/10 bg-white/80 p-3 dark:border-white/10 dark:bg-white/10">
                                    <p className="font-semibold text-zinc-900 dark:text-zinc-100">Turn Timer</p>
                                    <p className="text-zinc-600 dark:text-zinc-300">No stalling</p>
                                </div>
                                <div className="rounded-xl border border-black/10 bg-white/80 p-3 dark:border-white/10 dark:bg-white/10">
                                    <p className="font-semibold text-zinc-900 dark:text-zinc-100">Live Sync</p>
                                    <p className="text-zinc-600 dark:text-zinc-300">Websocket play</p>
                                </div>
                            </div>
                        </div>

                        <div className="relative mx-auto w-full max-w-lg">
                            <div className="rounded-3xl border border-black/10 bg-white/85 p-5 shadow-2xl shadow-black/10 dark:border-white/10 dark:bg-[#0e1622]/85 dark:shadow-cyan-500/10">
                                <div className="mb-4 flex items-center justify-between">
                                    <p className="text-xs uppercase tracking-[0.12em] text-zinc-600 dark:text-zinc-300">Playable Demo</p>
                                    <p className="rounded-full bg-zinc-900 px-2 py-1 text-[11px] font-bold text-white dark:bg-cyan-400 dark:text-zinc-900">SIM</p>
                                </div>

                                <div className="relative h-72 rounded-2xl border border-emerald-900/20 bg-[#14532d] p-4 dark:border-cyan-400/20 dark:bg-[#08232d]">
                                    <div className="absolute left-4 top-10 h-36 w-24 rotate-[-8deg] rounded-xl border border-black/20 bg-white p-2 shadow-lg transition-all duration-300">
                                        <p className={`text-xs font-bold ${cardColor(topCard.suit)}`}>{topCard.value} {topCard.suit}</p>
                                        <p className={`mt-10 text-center text-4xl ${cardColor(topCard.suit)}`}>{topCard.suit}</p>
                                    </div>
                                    <div className="absolute left-24 top-14 h-36 w-24 rotate-[8deg] rounded-xl border border-black/20 bg-white p-2 shadow-lg transition-all duration-300">
                                        <p className={`text-xs font-bold ${cardColor(previewBotCard.suit)}`}>{previewBotCard.value} {previewBotCard.suit}</p>
                                        <p className={`mt-10 text-center text-4xl ${cardColor(previewBotCard.suit)}`}>{previewBotCard.suit}</p>
                                    </div>
                                    <div className="absolute right-6 top-8 rounded-xl border border-white/20 bg-black/20 px-3 py-2 text-xs text-white backdrop-blur">
                                        <p>Deck: {demo.deck.length}</p>
                                        <p>Turn: {demo.turn === 'player' ? 'You' : 'Bot'}</p>
                                        <p>Status: {demo.status === 'finished' ? 'Finished' : 'Live'}</p>
                                    </div>

                                    <div className="absolute inset-x-4 bottom-4">
                                        <p className="mb-2 rounded-md bg-black/25 px-2 py-1 text-[11px] text-white/90">{demo.note}</p>
                                        <div className="flex gap-1 overflow-x-auto pb-1">
                                            {demo.playerHand.map((card, idx) => {
                                                const c = parseCard(card);
                                                const playable = canPlay(card, demo.topCard) && demo.turn === 'player' && demo.status === 'in_progress';
                                                return (
                                                    <button
                                                        key={`${card}-${idx}`}
                                                        type="button"
                                                        onClick={() => playDemoCard(card)}
                                                        disabled={!playable}
                                                        className={`h-14 w-10 shrink-0 rounded-md border border-black/20 bg-white text-[10px] font-bold shadow transition ${playable ? 'ring-2 ring-amber-300 hover:-translate-y-1' : 'opacity-80'}`}
                                                        title={playable ? 'Play card' : 'Not playable'}
                                                    >
                                                        <span className={cardColor(c.suit)}>{c.value}</span>
                                                        <br />
                                                        <span className={cardColor(c.suit)}>{c.suit}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                                    <div className="rounded-lg border border-black/10 bg-black/[0.03] p-2 text-zinc-700 dark:border-white/10 dark:bg-white/10 dark:text-zinc-200">
                                        You: {demo.playerHand.length}
                                    </div>
                                    <div className="rounded-lg border border-black/10 bg-black/[0.03] p-2 text-zinc-700 dark:border-white/10 dark:bg-white/10 dark:text-zinc-200">
                                        Bot: {demo.botHand.length}
                                    </div>
                                    <div className="rounded-lg border border-black/10 bg-black/[0.03] p-2 text-zinc-700 dark:border-white/10 dark:bg-white/10 dark:text-zinc-200">
                                        Winner: {demo.winner === null ? '-' : demo.winner === 'player' ? 'You' : 'Bot'}
                                    </div>
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={drawForPlayer}
                                        disabled={demo.turn !== 'player' || demo.status !== 'in_progress'}
                                        className="rounded-xl border border-black/15 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-white/10 dark:text-zinc-100 dark:hover:bg-white/20"
                                    >
                                        Draw Card
                                    </button>
                                    <button
                                        type="button"
                                        onClick={resetDemo}
                                        className="rounded-xl border border-black/15 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-50 dark:border-white/15 dark:bg-white/10 dark:text-zinc-100 dark:hover:bg-white/20"
                                    >
                                        Reset Demo
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="pb-14">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                                Round Flow
                            </h3>
                            <p className="text-xs uppercase tracking-[0.1em] text-zinc-500 dark:text-zinc-400">Quick and brutal</p>
                        </div>

                        <div className="grid gap-4 md:grid-cols-4">
                            <article className="rounded-2xl border border-black/10 bg-white/80 p-5 shadow-sm transition hover:-translate-y-1 dark:border-white/10 dark:bg-white/10">
                                <p className="text-xs uppercase tracking-[0.1em] text-zinc-500 dark:text-zinc-400">Step 1</p>
                                <h4 className="mt-2 text-base font-bold text-zinc-900 dark:text-zinc-100">Join Room</h4>
                                <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">Create or join a room with up to four players.</p>
                            </article>
                            <article className="rounded-2xl border border-black/10 bg-white/80 p-5 shadow-sm transition hover:-translate-y-1 dark:border-white/10 dark:bg-white/10">
                                <p className="text-xs uppercase tracking-[0.1em] text-zinc-500 dark:text-zinc-400">Step 2</p>
                                <h4 className="mt-2 text-base font-bold text-zinc-900 dark:text-zinc-100">Match Card</h4>
                                <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">Play by suit or value to keep momentum.</p>
                            </article>
                            <article className="rounded-2xl border border-black/10 bg-white/80 p-5 shadow-sm transition hover:-translate-y-1 dark:border-white/10 dark:bg-white/10">
                                <p className="text-xs uppercase tracking-[0.1em] text-zinc-500 dark:text-zinc-400">Step 3</p>
                                <h4 className="mt-2 text-base font-bold text-zinc-900 dark:text-zinc-100">Beat Timer</h4>
                                <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">Hesitate too long and your turn can collapse.</p>
                            </article>
                            <article className="rounded-2xl border border-black/10 bg-white/80 p-5 shadow-sm transition hover:-translate-y-1 dark:border-white/10 dark:bg-white/10">
                                <p className="text-xs uppercase tracking-[0.1em] text-zinc-500 dark:text-zinc-400">Step 4</p>
                                <h4 className="mt-2 text-base font-bold text-zinc-900 dark:text-zinc-100">Empty Hand</h4>
                                <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">First player out of cards wins the round.</p>
                            </article>
                        </div>
                    </section>

                    <section className="rounded-3xl border border-black/10 bg-zinc-900 p-6 text-zinc-100 shadow-2xl md:p-8 dark:border-white/10 dark:bg-[#05090f]">
                        <div className="grid gap-8 md:grid-cols-[0.95fr_1.05fr] md:items-center">
                            <div>
                                <h3 className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                                    Not another generic card page.
                                </h3>
                                <p className="mt-3 text-sm leading-relaxed text-zinc-300">
                                    This game is about pressure and imperfect decisions. That is the vibe the page should communicate too.
                                    Fast rounds, hard pivots, and no autopilot.
                                </p>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                                {auth.user ? (
                                    <>
                                        <Link
                                            href="/quick-ai-room"
                                            method="post"
                                            as="button"
                                            className="inline-flex items-center justify-center rounded-xl bg-zinc-100 px-5 py-3 text-sm font-bold text-zinc-900 transition hover:bg-white"
                                        >
                                            Quick AI Match
                                        </Link>
                                        <Link
                                            href={dashboard()}
                                            className="inline-flex items-center justify-center rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-zinc-900 transition hover:bg-cyan-300"
                                        >
                                            Open Dashboard
                                        </Link>
                                        <Link
                                            href={dashboard()}
                                            className="inline-flex items-center justify-center rounded-xl border border-zinc-500 px-5 py-3 text-sm font-semibold text-zinc-100 transition hover:border-zinc-300"
                                        >
                                            Manage Rooms
                                        </Link>
                                    </>
                                ) : (
                                    <>
                                        <Link
                                            href={register()}
                                            className="inline-flex items-center justify-center rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-zinc-900 transition hover:bg-cyan-300"
                                        >
                                            Sign Up and Play
                                        </Link>
                                        <Link
                                            href={login()}
                                            className="inline-flex items-center justify-center rounded-xl border border-zinc-500 px-5 py-3 text-sm font-semibold text-zinc-100 transition hover:border-zinc-300"
                                        >
                                            Log In
                                        </Link>
                                    </>
                                )}
                            </div>
                        </div>
                    </section>
                </main>

                <footer className="mx-auto w-full max-w-6xl px-6 pb-8 pt-8 text-xs text-zinc-500 dark:text-zinc-400 md:px-8">
                    © {new Date().getFullYear()} No Time Left. All rights reserved.
                </footer>
            </div>
        </>
    );
}
