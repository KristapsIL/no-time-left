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
      <Head title="No Time Left" />
      <div className="min-h-screen p-6">
        <div className="max-w-6xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <div className="relative">
              <h1 className="text-6xl md:text-7xl font-bold text-gray-900 dark:text-white mb-4 tracking-wider">
                NO TIME LEFT
              </h1>
              <div className="flex justify-center gap-2 mb-6">
                {playingCards.map((suit, i) => (
                  <div
                    key={suit}
                    className={`text-4xl transition-all duration-700 delay-${i * 200} ${
                      showCards ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                    } ${suit === '♥' || suit === '♦' ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}
                  >
                    {suit}
                  </div>
                ))}
              </div>
              <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed">
                A fast-paced card game where every move counts. Match suits, beat the clock, and outlast your opponents in this thrilling card battle.
              </p>
            </div>
          </div>

          {/* Game Features */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center border border-white/20">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Lightning Fast</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Quick rounds that keep you on the edge of your seat. No time to hesitate!
              </p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center border border-white/20">
              <div className="text-4xl mb-4">🃏</div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Strategic Play</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Master the art of card matching with traditional suits and strategic timing.
              </p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center border border-white/20">
              <div className="text-4xl mb-4">👥</div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Multiplayer</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Play with 2-4 friends in real-time. Create rooms and challenge your skills!
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="text-center space-y-4 mb-12">
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button 
                onClick={() => router.visit('/findRoom')}
                className="px-8 py-4 bg-white text-gray-900 font-bold rounded-xl hover:bg-gray-50 transition-all duration-300 transform hover:scale-105 shadow-lg text-lg dark:bg-gray-700 dark:text-white dark:hover:bg-gray-800"
              >
                🎮 Find Game
              </button>
              <button 
                onClick={() => router.visit('/cardgame/create-room')}
                className="px-8 py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all duration-300 transform hover:scale-105 shadow-lg text-lg"
              >
                ➕ Create Room
              </button>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Need 2-4 players to start • Custom rules available • Real-time multiplayer
            </p>
          </div>

          {/* How to Play */}
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl p-8 border border-gray-200 dark:border-gray-700 shadow-lg">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white text-center mb-6">How to Play</h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="bg-indigo-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">1</div>
                  <div>
                    <h4 className="text-gray-900 dark:text-white font-semibold">Match the Top Card</h4>
                    <p className="text-gray-600 dark:text-gray-300 text-sm">Play a card that matches the suit (♠♥♦♣) of the top card on the discard pile.</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="bg-indigo-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">2</div>
                  <div>
                    <h4 className="text-gray-900 dark:text-white font-semibold">Draw When Stuck</h4>
                    <p className="text-gray-600 dark:text-gray-300 text-sm">Can't play? Draw from the deck until you get a playable card.</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="bg-indigo-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">3</div>
                  <div>
                    <h4 className="text-gray-900 dark:text-white font-semibold">Race Against Time</h4>
                    <p className="text-gray-600 dark:text-gray-300 text-sm">Make quick decisions - other players won't wait forever!</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="bg-indigo-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">4</div>
                  <div>
                    <h4 className="text-gray-900 dark:text-white font-semibold">First to Empty Wins</h4>
                    <p className="text-gray-600 dark:text-gray-300 text-sm">Be the first player to play all your cards and claim victory!</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Developed by K. I. Liepins | Contact: ipb22.k.liepins@vtdt.edu.lv
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
