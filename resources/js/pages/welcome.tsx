import { dashboard, login, register } from '@/routes';
import { type SharedData } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import type { CSSProperties } from 'react';

const heroMetrics = [
    { value: '2-4', label: 'players per room' },
    { value: 'Live', label: 'sync every turn' },
    { value: 'Fast', label: 'AI room starts' },
];

const playSteps = [
    {
        step: '01',
        eyebrow: 'Join',
        title: 'Create a room or jump into one instantly',
        text: 'Public listings, room codes, and quick AI starts keep setup friction low on desktop and mobile.',
    },
    {
        step: '02',
        eyebrow: 'Play',
        title: 'Match suit or value under time pressure',
        text: 'Each turn is simple, but the timer and hand state make pace control the real strategy layer.',
    },
    {
        step: '03',
        eyebrow: 'Win',
        title: 'Empty your hand before the table catches up',
        text: 'Fast rounds, live updates, and quick resets make replaying feel immediate instead of procedural.',
    },
];

const featureCards = [
    {
        icon: '⚡',
        title: 'Live Room Sync',
        text: 'Turns, pickups, chat, and finish states broadcast instantly so the table stays aligned.',
        accent: 'bg-cyan-100 dark:bg-cyan-900/40',
    },
    {
        icon: '🎛',
        title: 'Room Rules',
        text: 'Set player counts, timer pressure, and AI support without pushing users through a heavy setup flow.',
        accent: 'bg-orange-100 dark:bg-orange-900/40',
    },
    {
        icon: '🤖',
        title: 'AI Fill Seats',
        text: 'Bots let a room start immediately and keep solo play available when a full table is not.',
        accent: 'bg-emerald-100 dark:bg-emerald-900/40',
    },
    {
        icon: '💬',
        title: 'Built-In Chat',
        text: 'Room chat keeps coordination and social play inside the same interface as the board.',
        accent: 'bg-amber-100 dark:bg-amber-900/40',
    },
];

export default function Welcome() {
    const { auth } = usePage<SharedData>().props;
    const pageTheme = {
        '--page-bg': '#f6efe2',
        '--page-ink': '#18181b',
        '--panel-soft': 'rgba(255,255,255,0.7)',
        '--panel-line': 'rgba(24,24,27,0.1)',
        '--hero-glow': 'rgba(249,115,22,0.18)',
        '--hero-glow-alt': 'rgba(34,211,238,0.16)',
    } as CSSProperties;

    return (
        <>
            <Head title="No Time Left">
                <link rel="preconnect" href="https://fonts.bunny.net" />
                <link href="https://fonts.bunny.net/css?family=manrope:400,500,700,800|space-grotesk:500,700" rel="stylesheet" />
            </Head>

            <div
                className="relative min-h-screen overflow-hidden bg-[var(--page-bg)] text-[var(--page-ink)] transition-colors dark:bg-[#070b10] dark:text-[#f5f7ff]"
                style={{ ...pageTheme, fontFamily: 'Manrope, sans-serif' }}
            >
                <div className="pointer-events-none absolute inset-0">
                    <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-[var(--hero-glow)] blur-3xl dark:bg-[#22d3ee]/10" />
                    <div className="absolute right-[-60px] top-1/4 h-80 w-80 rounded-full bg-[var(--hero-glow-alt)] blur-3xl dark:bg-[#34d399]/10" />
                    <div className="absolute bottom-[-80px] left-1/3 h-80 w-80 rounded-full bg-[#eab308]/15 blur-3xl dark:bg-[#a78bfa]/10" />
                    <div className="absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.6),transparent_70%)] dark:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_70%)]" />
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
                    <section className="pb-14 pt-8 lg:pt-10">
                        <div className="mx-auto max-w-4xl space-y-7 text-center">
                            <div className="space-y-4">
                                <p className="inline-flex items-center gap-2 rounded-full border border-[var(--panel-line)] bg-[var(--panel-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-700 backdrop-blur-sm dark:border-white/15 dark:bg-white/10 dark:text-zinc-200">
                                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                    Real-time Room Card Game
                                </p>

                                <h2
                                    className="mx-auto max-w-3xl text-5xl font-extrabold leading-[0.95] tracking-tight text-zinc-900 sm:text-6xl lg:text-7xl dark:text-zinc-100"
                                    style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                                >
                                    Fast rounds.
                                    <br />
                                    Tight pressure.
                                    <br />
                                    No dead time.
                                </h2>

                                <p className="mx-auto max-w-2xl text-base leading-7 text-zinc-700 sm:text-lg dark:text-zinc-300">
                                    No Time Left is a browser card game built around room-based play, quick starts, and visible pressure.
                                    Match suit or value, manage the clock, and keep the pace moving whether you play solo against AI or in a live multiplayer table.
                                </p>
                            </div>

                            <div className="mx-auto grid max-w-2xl gap-3 sm:grid-cols-3">
                                {heroMetrics.map((metric) => (
                                    <div
                                        key={metric.label}
                                        className="rounded-2xl border border-[var(--panel-line)] bg-white/70 p-4 backdrop-blur-sm dark:border-white/10 dark:bg-white/10"
                                    >
                                        <p
                                            className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-100"
                                            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                                        >
                                            {metric.value}
                                        </p>
                                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{metric.label}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="mx-auto grid max-w-2xl gap-3 text-sm text-zinc-700 sm:grid-cols-3 dark:text-zinc-300">
                                <div className="rounded-2xl border border-black/10 bg-white/75 p-4 dark:border-white/10 dark:bg-white/10">
                                    On each turn, either play a valid card or draw.
                                </div>
                                <div className="rounded-2xl border border-black/10 bg-white/75 p-4 dark:border-white/10 dark:bg-white/10">
                                    Turn timers keep rounds moving and punish hesitation.
                                </div>
                                <div className="rounded-2xl border border-black/10 bg-white/75 p-4 dark:border-white/10 dark:bg-white/10">
                                    Winning is simple: be the first player with an empty hand.
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
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
                        </div>
                    </section>

                    <section className="pb-12">
                        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Flow</p>
                                <h3 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                                    From room entry to final card, the loop stays short.
                                </h3>
                            </div>
                            <p className="text-sm text-zinc-600 dark:text-zinc-300">Simple rules, visible pressure, fast re-entry.</p>
                        </div>

                        <div className="grid gap-4 lg:grid-cols-3">
                            {playSteps.map((item) => (
                                <article
                                    key={item.step}
                                    className="group relative overflow-hidden rounded-[1.75rem] border border-black/10 bg-white/85 p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-xl dark:border-white/10 dark:bg-white/10"
                                >
                                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400 via-orange-400 to-rose-400 opacity-80" />
                                    <span className="pointer-events-none absolute -right-2 -top-4 select-none text-8xl font-black leading-none text-zinc-900/[0.05] transition group-hover:scale-105 dark:text-white/[0.06]">
                                        {item.step}
                                    </span>
                                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700 dark:text-cyan-300">{item.eyebrow}</p>
                                    <h4 className="mt-3 text-lg font-bold text-zinc-900 dark:text-zinc-100">{item.title}</h4>
                                    <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{item.text}</p>
                                </article>
                            ))}
                        </div>
                    </section>

                    <section className="pb-14">
                        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Highlights</p>
                                <h3 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                                    Designed around readable status and immediate action.
                                </h3>
                            </div>
                            <p className="text-sm text-zinc-600 dark:text-zinc-300">Everything important stays close to the player.</p>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            {featureCards.map((feature) => (
                                <div
                                    key={feature.title}
                                    className="rounded-[1.6rem] border border-black/10 bg-white/85 p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-xl dark:border-white/10 dark:bg-white/10"
                                >
                                    <div className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl text-xl ${feature.accent}`}>
                                        {feature.icon}
                                    </div>
                                    <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{feature.title}</p>
                                    <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{feature.text}</p>
                                </div>
                            ))}
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
