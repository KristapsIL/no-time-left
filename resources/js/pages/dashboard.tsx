import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import { router } from '@inertiajs/react';

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Home', href: '/dashboard' },
];

export default function Dashboard() {
  const [showCards, setShowCards] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => setShowCards(true), 500);
    return () => clearTimeout(timer);
  }, []);

  const playingCards = ['♠', '♥', '♦', '♣'];

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Home" />
      <div className="min-h-[100dvh] p-4 md:p-6">
        <div className="max-w-6xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-10">
            <div className="relative">
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400 mb-3">No Time Left</p>
              <h1 className="text-5xl md:text-7xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                HOME
              </h1>
              <div className="flex justify-center gap-2 mb-6">
                {playingCards.map((suit, i) => (
                  <div
                    key={suit}
                    className={`text-4xl transition-all duration-700 delay-${i * 200} ${
                      showCards ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                    } ${suit === '♥' || suit === '♦' ? 'text-red-500' : 'text-zinc-900 dark:text-zinc-100'}`}
                  >
                    {suit}
                  </div>
                ))}
              </div>
              <p className="text-base md:text-lg text-zinc-600 dark:text-zinc-300 max-w-2xl mx-auto leading-relaxed">
                Your main hub for creating rooms, finding matches, and starting fast AI rounds.
              </p>
            </div>
          </div>

          {/* Game Features */}
          <div className="grid md:grid-cols-3 gap-4 mb-10">
            <div className="bg-white/70 dark:bg-white/5 backdrop-blur-sm rounded-2xl p-5 text-center border border-black/10 dark:border-white/10">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Lightning Fast</h3>
              <p className="text-zinc-600 dark:text-zinc-300 text-sm">
                Quick rounds that keep you on the edge of your seat. No time to hesitate!
              </p>
            </div>
            
            <div className="bg-white/70 dark:bg-white/5 backdrop-blur-sm rounded-2xl p-5 text-center border border-black/10 dark:border-white/10">
              <div className="text-4xl mb-4">🃏</div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Strategic Play</h3>
              <p className="text-zinc-600 dark:text-zinc-300 text-sm">
                Master the art of card matching with traditional suits and strategic timing.
              </p>
            </div>
            
            <div className="bg-white/70 dark:bg-white/5 backdrop-blur-sm rounded-2xl p-5 text-center border border-black/10 dark:border-white/10">
              <div className="text-4xl mb-4">👥</div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Bots Included</h3>
              <p className="text-zinc-600 dark:text-zinc-300 text-sm">
                Jump in solo with AI auto-fill or battle friends in live multiplayer rooms.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="text-center space-y-4 mb-10">
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button 
                onClick={() => router.visit('/findRoom')}
                className="px-6 py-3 bg-white text-zinc-900 font-bold rounded-xl hover:bg-zinc-50 transition-all duration-300 transform hover:scale-105 shadow-lg text-base dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700"
              >
                🎮 Find Game
              </button>
              <button 
                onClick={() => router.visit('/createRoom')}
                className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all duration-300 transform hover:scale-105 shadow-lg text-base"
              >
                ➕ Create Room
              </button>
              <button 
                onClick={() => router.post('/quick-ai-room')}
                className="px-6 py-3 bg-cyan-500 text-zinc-900 font-bold rounded-xl hover:bg-cyan-400 transition-all duration-300 transform hover:scale-105 shadow-lg text-base"
              >
                🤖 Quick AI Match
              </button>
            </div>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">
              Need 2-4 players • Bot difficulty controls • Real-time multiplayer
            </p>
          </div>

          {/* How to Play */}
          <div className="bg-white/80 dark:bg-zinc-900/70 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-black/10 dark:border-white/10 shadow-lg">
            <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 text-center mb-6">How to Play</h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="bg-indigo-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">1</div>
                  <div>
                    <h4 className="text-zinc-900 dark:text-zinc-100 font-semibold">Match the Top Card</h4>
                    <p className="text-zinc-600 dark:text-zinc-300 text-sm">Play a card that matches suit or value of the top discard card.</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="bg-indigo-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">2</div>
                  <div>
                    <h4 className="text-zinc-900 dark:text-zinc-100 font-semibold">Draw When Stuck</h4>
                    <p className="text-zinc-600 dark:text-zinc-300 text-sm">No legal play? Draw cards, then pass the pressure onward.</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="bg-indigo-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">3</div>
                  <div>
                    <h4 className="text-zinc-900 dark:text-zinc-100 font-semibold">Race Against Time</h4>
                    <p className="text-zinc-600 dark:text-zinc-300 text-sm">Every room has a turn timer, so hesitating can cost you cards.</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="bg-indigo-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">4</div>
                  <div>
                    <h4 className="text-zinc-900 dark:text-zinc-100 font-semibold">First to Empty Wins</h4>
                    <p className="text-zinc-600 dark:text-zinc-300 text-sm">Drop every card in your hand before opponents do.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-10 pt-8 border-t border-zinc-200 dark:border-zinc-800">
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">
              Developed by K. I. Liepins | Contact: ipb22.k.liepins@vtdt.edu.lv
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
