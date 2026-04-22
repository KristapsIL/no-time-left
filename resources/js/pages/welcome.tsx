import { dashboard, login, register } from '@/routes';
import { type SharedData } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { useCallback, useEffect, useState } from 'react';

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
    hasDrawnThisTurn: boolean;
    justDrawn: string[];
};

const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const cardColor = (suit: string) => (suit === '♥' || suit === '♦' ? 'text-rose-600' : 'text-zinc-900');

const parseCard = (card: string): { value: string; suit: string } => {
    const [value = '', suit = ''] = card.split('-');
    return { value, suit };
};

const DemoCardFace = ({ card, className = '' }: { card: string; className?: string }) => {
    const c = parseCard(card);
    return (
        <div className={`relative overflow-hidden rounded-xl border-2 border-black/20 bg-white shadow-lg ${className}`}>
            <span className={`absolute left-1.5 top-1 text-[10px] font-bold leading-none ${cardColor(c.suit)}`}>{c.value}</span>
            <span className={`absolute left-1.5 top-4 text-xs leading-none ${cardColor(c.suit)}`}>{c.suit}</span>
            <span className={`absolute right-1.5 bottom-1 text-xs rotate-180 leading-none ${cardColor(c.suit)}`}>{c.suit}</span>
            <span className={`absolute inset-0 flex items-center justify-center text-2xl font-bold ${cardColor(c.suit)}`}>{c.suit}</span>
        </div>
    );
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
        hasDrawnThisTurn: false,
        justDrawn: [],
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
                hasDrawnThisTurn: false,
                justDrawn: [],
            };
        });
    }, []);

    const drawForPlayer = useCallback(() => {
        setDemo((prev) => {
            if (prev.status !== 'in_progress' || prev.turn !== 'player' || prev.hasDrawnThisTurn) return prev;
            const drawn = prev.deck[prev.deck.length - 1];
            if (!drawn) return { ...prev, note: 'Deck is empty.' };

            const newPlayerHand = [...prev.playerHand, drawn];
            const newJustDrawn = [drawn];
            const canPlayJustDrawn = canPlay(drawn, prev.topCard);

            return {
                ...prev,
                deck: prev.deck.slice(0, -1),
                playerHand: newPlayerHand,
                justDrawn: newJustDrawn,
                hasDrawnThisTurn: true,
                note: canPlayJustDrawn 
                    ? `You drew ${drawn.replace('-', ' ')}. You can play it!` 
                    : `You drew ${drawn.replace('-', ' ')}. Your turn ends.`,
                turn: canPlayJustDrawn ? 'player' : 'bot',
            };
        });
    }, []);

    useEffect(() => {
        if (demo.status !== 'in_progress' || demo.turn !== 'bot') return;

        const timeout = window.setTimeout(() => {
            setDemo((prev) => {
                if (prev.status !== 'in_progress' || prev.turn !== 'bot') return prev;

                // Try to play from current hand; if not, draw exactly one card
                let botHand = [...prev.botHand];
                let botDeck = [...prev.deck];
                let playableCard = botHand.find((c) => canPlay(c, prev.topCard)) ?? null;

                if (!playableCard && botDeck.length > 0) {
                    const drawn = botDeck.pop()!;
                    botHand = [...botHand, drawn];
                    if (canPlay(drawn, prev.topCard)) playableCard = drawn;
                }

                if (!playableCard) {
                    return {
                        ...prev,
                        botHand,
                        deck: botDeck,
                        turn: 'player',
                        note: 'Bot drew a card and passed. Your turn.',
                        hasDrawnThisTurn: false,
                        justDrawn: [],
                    };
                }

                const cardIndex = botHand.indexOf(playableCard);
                const nextBotHand = botHand.filter((_, i) => i !== cardIndex);

                if (nextBotHand.length === 0) {
                    return {
                        ...prev,
                        botHand: [],
                        deck: botDeck,
                        topCard: playableCard,
                        status: 'finished',
                        winner: 'bot',
                        note: `Bot played ${playableCard.replace('-', ' ')} and won.`,
                    };
                }

                return {
                    ...prev,
                    botHand: nextBotHand,
                    deck: botDeck,
                    topCard: playableCard,
                    turn: 'player',
                    note: `Bot played ${playableCard.replace('-', ' ')}. Your turn.`,
                    hasDrawnThisTurn: false,
                    justDrawn: [],
                };
            });
        }, 900);

        return () => window.clearTimeout(timeout);
    }, [demo.status, demo.turn]);

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
                                Home
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
                                            Open Game Hub
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
                                    <p className="text-xs uppercase tracking-[0.12em] text-zinc-600 dark:text-zinc-300">Playable Demo Board</p>
                                    <p className="rounded-full bg-zinc-900 px-2 py-1 text-[11px] font-bold text-white dark:bg-cyan-400 dark:text-zinc-900">LIVE</p>
                                </div>

                                <div className="flex flex-col gap-4 rounded-2xl border border-emerald-900/20 bg-[#14532d] p-4 dark:border-cyan-400/20 dark:bg-[#08232d]">
                                    {/* Bot Hand Section */}
                                    <div>
                                        <p className="mb-2 text-xs font-semibold text-white/60">BOT ({demo.botHand.length})</p>
                                        <div className="flex items-center gap-2">
                                            <div className="flex gap-1">
                                                {demo.botHand.slice(0, 3).map((_, idx) => (
                                                    <div
                                                        key={`bot-${idx}`}
                                                        className="relative h-16 w-11 overflow-hidden rounded-lg border border-black/30 bg-gradient-to-br from-zinc-800 to-zinc-900 shadow-md"
                                                    />
                                                ))}
                                            </div>
                                            {demo.botHand.length > 3 && (
                                                <p className="text-xs text-white/70">+{demo.botHand.length - 3}</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Middle: Top Card + Deck */}
                                    <div className="flex items-center justify-between">
                                        {/* Top Card */}
                                        <div className="flex-1">
                                            <div className="mx-auto h-24 w-16">
                                                <DemoCardFace card={demo.topCard} className="h-24 w-16" />
                                            </div>
                                        </div>

                                        {/* Deck & Info */}
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="h-20 w-14 rounded-lg border-2 border-dashed border-white/30 bg-white/10 flex items-center justify-center">
                                                <div className="text-center">
                                                    <p className="text-sm font-bold text-white">{demo.deck.length}</p>
                                                    <p className="text-[10px] text-white/60">left</p>
                                                </div>
                                            </div>
                                            <div className="rounded-lg bg-black/30 px-2 py-1 text-center text-[10px] text-white">
                                                <p className="font-semibold">{demo.turn === 'player' ? 'Your Turn' : 'Bot Turn'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Player Hand Section */}
                                    <div>
                                        <p className="mb-2 text-xs font-semibold text-white/60">YOUR HAND ({demo.playerHand.length})</p>
                                        <div className="flex gap-2 overflow-x-auto pb-2">
                                            {demo.playerHand.map((card, idx) => {
                                                const playable = canPlay(card, demo.topCard) && demo.turn === 'player' && demo.status === 'in_progress';
                                                const isJustDrawn = demo.justDrawn.includes(card);
                                                return (
                                                    <button
                                                        key={`${card}-${idx}`}
                                                        type="button"
                                                        onClick={() => playDemoCard(card)}
                                                        disabled={!playable}
                                                        className={`h-24 w-16 shrink-0 rounded-lg border-2 font-bold shadow-lg transition ${
                                                            playable 
                                                                ? 'border-amber-400 bg-white hover:-translate-y-2 cursor-pointer ring-2 ring-amber-300' 
                                                                : 'border-zinc-300 bg-white/80 opacity-55'
                                                        } ${isJustDrawn ? 'ring-2 ring-green-400 border-green-400' : ''}`}
                                                        title={playable ? 'Click to play' : 'Not playable'}
                                                    >
                                                        <DemoCardFace card={card} className="h-full w-full" />
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Status / Note */}
                                    {demo.status === 'finished' ? (
                                        <div className="rounded-lg bg-yellow-900/30 px-3 py-2 text-center">
                                            <p className="text-sm font-bold text-yellow-100">
                                                {demo.winner === 'player' ? '🎉 You Won!' : '🤖 Bot Won!'}
                                            </p>
                                        </div>
                                    ) : (
                                        <p className="text-center text-[11px] text-white/55">{demo.note}</p>
                                    )}
                                </div>

                                {/* Controls */}
                                <div className="mt-4 flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={drawForPlayer}
                                        disabled={demo.turn !== 'player' || demo.status !== 'in_progress' || demo.hasDrawnThisTurn || demo.playerHand.some((card) => canPlay(card, demo.topCard))}
                                        className="flex-1 rounded-xl border border-black/15 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:bg-white/10 dark:text-zinc-100 dark:hover:bg-white/20"
                                    >
                                        {demo.hasDrawnThisTurn ? 'Drew Once' : 'Draw Card'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={resetDemo}
                                        className="flex-1 rounded-xl border border-black/15 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-50 dark:border-white/15 dark:bg-white/10 dark:text-zinc-100 dark:hover:bg-white/20"
                                    >
                                        Reset
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="pb-12">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                                How It Works
                            </h3>
                            <p className="text-xs uppercase tracking-[0.1em] text-zinc-500 dark:text-zinc-400">Simple flow, high pressure</p>
                        </div>

                        <div className="grid gap-4 md:grid-cols-3">
                            <article className="relative overflow-hidden rounded-2xl border border-black/10 bg-white/85 p-5 shadow-sm dark:border-white/10 dark:bg-white/10">
                                <span className="pointer-events-none absolute -right-1 -top-3 select-none text-7xl font-black leading-none text-zinc-900/[0.05] dark:text-white/[0.06]">01</span>
                                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-cyan-600 dark:text-cyan-400">Join</p>
                                <h4 className="mt-2 text-base font-bold text-zinc-900 dark:text-zinc-100">Create or Enter a Room</h4>
                                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Public and private rooms support quick solo starts or full multiplayer tables.</p>
                            </article>
                            <article className="relative overflow-hidden rounded-2xl border border-black/10 bg-white/85 p-5 shadow-sm dark:border-white/10 dark:bg-white/10">
                                <span className="pointer-events-none absolute -right-1 -top-3 select-none text-7xl font-black leading-none text-zinc-900/[0.05] dark:text-white/[0.06]">02</span>
                                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-cyan-600 dark:text-cyan-400">Play</p>
                                <h4 className="mt-2 text-base font-bold text-zinc-900 dark:text-zinc-100">Match Suit or Value</h4>
                                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Every turn is straightforward, but timing and hand management decide who controls the pace.</p>
                            </article>
                            <article className="relative overflow-hidden rounded-2xl border border-black/10 bg-white/85 p-5 shadow-sm dark:border-white/10 dark:bg-white/10">
                                <span className="pointer-events-none absolute -right-1 -top-3 select-none text-7xl font-black leading-none text-zinc-900/[0.05] dark:text-white/[0.06]">03</span>
                                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-cyan-600 dark:text-cyan-400">Finish</p>
                                <h4 className="mt-2 text-base font-bold text-zinc-900 dark:text-zinc-100">Empty Hand to Win</h4>
                                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Beat the timer, force hard decisions, and clear your hand before anyone else does.</p>
                            </article>
                        </div>
                    </section>

                    <section className="pb-14">
                        <div className="mb-5 flex items-center justify-between">
                            <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                                Built for Clean, Real-Time Play
                            </h3>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <div className="rounded-2xl border border-black/10 bg-white/85 p-5 shadow-sm dark:border-white/10 dark:bg-white/10">
                                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-100 text-lg dark:bg-cyan-900/40">⚡</div>
                                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Live Room Sync</p>
                                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">Instant state updates for turns, hands, and top card via WebSocket.</p>
                            </div>
                            <div className="rounded-2xl border border-black/10 bg-white/85 p-5 shadow-sm dark:border-white/10 dark:bg-white/10">
                                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-lg dark:bg-emerald-900/40">🚀</div>
                                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Fast Room Setup</p>
                                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">Create custom rooms with rules and launch without a long setup flow.</p>
                            </div>
                            <div className="rounded-2xl border border-black/10 bg-white/85 p-5 shadow-sm dark:border-white/10 dark:bg-white/10">
                                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-lg dark:bg-violet-900/40">🤖</div>
                                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">AI Opponents</p>
                                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">Fill seats with bots at adjustable difficulty so rounds start immediately.</p>
                            </div>
                            <div className="rounded-2xl border border-black/10 bg-white/85 p-5 shadow-sm dark:border-white/10 dark:bg-white/10">
                                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-lg dark:bg-amber-900/40">⏱</div>
                                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Turn Timer</p>
                                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">Configurable timer keeps rounds focused and eliminates stalled turns.</p>
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
