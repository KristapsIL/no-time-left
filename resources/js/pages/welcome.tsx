import { dashboard, login, register } from '@/routes';
import { type SharedData } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';

export default function Welcome() {
    const { auth } = usePage<SharedData>().props;

    return (
        <>
            <Head title="Welcome">
                <link rel="preconnect" href="https://fonts.bunny.net" />
                <link href="https://fonts.bunny.net/css?family=instrument-sans:400,500,600" rel="stylesheet" />
            </Head>

            <div className="flex min-h-screen flex-col items-center justify-between bg-[#FDFDFC] px-6 py-10 text-[#1b1b18] dark:bg-[#0a0a0a] dark:text-[#EDEDEC]">
                {/* Header */}
                <header className="w-full max-w-5xl flex justify-between items-center text-sm">
                    <h1 className="text-xl font-semibold tracking-wide">No Time Left</h1>
                    <nav className="flex items-center gap-4">
                        {auth.user ? (
                            <Link
                                href={dashboard()}
                                className="inline-block rounded-sm border border-[#19140035] px-5 py-1.5 text-sm leading-normal text-[#1b1b18] hover:border-[#1915014a] dark:border-[#3E3E3A] dark:text-[#EDEDEC] dark:hover:border-[#62605b]"
                            >
                                Dashboard
                            </Link>
                        ) : (
                            <>
                                <Link
                                    href={login()}
                                    className="inline-block rounded-sm border border-transparent px-5 py-1.5 text-sm leading-normal text-[#1b1b18] hover:border-[#19140035] dark:text-[#EDEDEC] dark:hover:border-[#3E3E3A]"
                                >
                                    Log in
                                </Link>
                                <Link
                                    href={register()}
                                    className="inline-block rounded-sm border border-[#19140035] px-5 py-1.5 text-sm leading-normal text-[#1b1b18] hover:border-[#1915014a] dark:border-[#3E3E3A] dark:text-[#EDEDEC] dark:hover:border-[#62605b]"
                                >
                                    Register
                                </Link>
                            </>
                        )}
                    </nav>
                </header>

                {/* Main Content */}
                <main className="flex flex-col items-center justify-center text-center flex-grow relative">
                    {/* Decorative 4 Aces */}
                    <div className="relative mb-10 h-64 w-72 flex items-center justify-center">
                        {[
                            { suit: '♠', color: 'text-gray-900', fan: '-translate-x-16 translate-y-3 rotate-[-12deg]' },
                            { suit: '♥', color: 'text-red-600', fan: '-translate-x-5 translate-y-1 rotate-[-4deg]' },
                            { suit: '♦', color: 'text-red-600', fan: 'translate-x-5 translate-y-1 rotate-[4deg]' },
                            { suit: '♣', color: 'text-gray-900', fan: 'translate-x-16 translate-y-3 rotate-[12deg]' },
                        ].map((card, i) => (
                            <div
                                key={i}
                                className={`absolute ${card.fan} transition-transform duration-300 hover:-translate-y-2`}
                                style={{ zIndex: i + 1 }}
                            >
                                <div
                                    className="w-24 h-36 bg-white dark:bg-[#1b1b18] border border-[#19140035] dark:border-[#3E3E3A]
                                            rounded-lg shadow-xl flex flex-col justify-between items-start px-2 py-1"
                                    style={{
                                        background: 'linear-gradient(145deg, #ffffff 0%, #f6f6f6 100%)',
                                    }}
                                >
                                    <div className={`text-sm font-bold ${card.color}`}>
                                        A<span className="ml-0.5">{card.suit}</span>
                                    </div>
                                    <div className={`text-3xl self-center ${card.color} opacity-60`}>
                                        {card.suit}
                                    </div>
                                    <div className={`text-sm font-bold ${card.color} rotate-180 self-end`}>
                                        A<span className="ml-0.5">{card.suit}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <h2 className="text-5xl font-semibold tracking-tight mb-3">
                        Welcome to <span className="italic">No Time Left</span>
                    </h2>
                    <p className="text-base max-w-md text-[#35352F] dark:text-[#C8C8C5] mb-8">
                        A fast-paced strategic card game where every move matters. Outsmart your opponents and play your cards before the clock runs out.
                    </p>

                    {auth.user ? (
                        <Link
                            href={dashboard()}
                            className="rounded-md border border-[#19140035] px-8 py-3 text-sm font-medium hover:border-[#1915014a] hover:bg-[#1b1b1820] dark:border-[#3E3E3A] dark:hover:border-[#62605b]"
                        >
                            Go to Dashboard
                        </Link>
                    ) : (
                        <div className="flex flex-col sm:flex-row gap-4">
                            <Link
                                href={register()}
                                className="rounded-md border border-[#19140035] px-8 py-3 text-sm font-medium hover:border-[#1915014a] hover:bg-[#1b1b1820] dark:border-[#3E3E3A] dark:hover:border-[#62605b]"
                            >
                                Get Started
                            </Link>
                            <Link
                                href={login()}
                                className="rounded-md border border-transparent px-8 py-3 text-sm font-medium hover:border-[#19140035] dark:text-[#EDEDEC] dark:hover:border-[#3E3E3A]"
                            >
                                Log In
                            </Link>
                        </div>
                    )}
                </main>

                {/* Footer */}
                <footer className="mt-10 text-xs text-[#606058] dark:text-[#9D9D9B]">
                    © {new Date().getFullYear()} No Time Left. All rights reserved.
                </footer>
            </div>
        </>
    );
}
