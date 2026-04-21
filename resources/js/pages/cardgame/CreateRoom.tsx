import React, { useEffect, useState } from "react";
import AppLayout from '@/layouts/app-layout';
import { Head, router } from "@inertiajs/react";

export default function CreateRoom() {
  const [Name, setName] = useState<string>('');
  const [isPublic, setIsPublic] = useState(true);
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [turnTimeout, setTurnTimeout] = useState(5);
  const [botFillCount, setBotFillCount] = useState(1);
  const [botDifficulty, setBotDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [rules, setRules] = useState<string[]>([]);

  useEffect(() => {
    const maxBots = Math.max(0, maxPlayers - 1);
    if (botFillCount > maxBots) {
      setBotFillCount(maxBots);
    }
  }, [maxPlayers, botFillCount]);

  const handleRuleChange = (rule: string) => {
    setRules((prev) =>
      prev.includes(rule) ? prev.filter((r) => r !== rule) : [...prev, rule]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.post("/storeRules", {
      room_name: Name,
      public: isPublic,
      max_players: maxPlayers,
      turn_timeout_seconds: turnTimeout,
      bot_fill_count: botFillCount,
      bot_difficulty: botDifficulty,
      rules: rules,
    });
  };

  return (
    <AppLayout>
      <Head title="Create Room" />
      <div className="p-4 md:p-6 flex justify-center min-h-[100dvh]">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Create New Room
            </h1>
            <p className="text-zinc-600 dark:text-zinc-300">
              Set up your game with custom rules and invite friends
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="bg-white/85 dark:bg-[#0d1621]/85 rounded-2xl shadow-lg border border-black/10 dark:border-white/10 p-5 md:p-8 space-y-6 backdrop-blur"
            aria-label="Create Room Form"
          >

            {/* Room Name */}
            <div>
              <label
                htmlFor="room_name"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Room Name
              </label>
              <input
                id="room_name"
                name="room_name"
                type="text"
                value={Name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-3 py-2 text-gray-800 dark:text-gray-100 dark:bg-neutral-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="Enter room name"
                required
                aria-required="true"
                aria-describedby="room_name_help"
              />
              <p id="room_name_help" className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                4–254 characters. Must be unique.
              </p>
            </div>

            {/* Public Toggle */}
            <div>
              <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Visibility
              </span>
              <label className="inline-flex items-center gap-2">
                <input
                  id="public"
                  name="public"
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="h-4 w-4 accent-indigo-600"
                  aria-checked={isPublic}
                />
                <span className="text-gray-700 dark:text-gray-300">
                  Public Room
                </span>
              </label>
            </div>

            {/* Max Players */}
            <div>
              <label
                htmlFor="max_players"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Max Players
              </label>
              <select
                id="max_players"
                name="max_players"
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(Number(e.target.value))}
                className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-3 py-2 dark:bg-neutral-800 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500"
                aria-label="Select max players"
              >
                <option value={2}>2 Players</option>
                <option value={3}>3 Players</option>
                <option value={4}>4 Players</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="turn_timeout_seconds"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Turn timeout (seconds)
              </label>
              <input
                id="turn_timeout_seconds"
                name="turn_timeout_seconds"
                type="number"
                min={2}
                max={60}
                value={turnTimeout}
                onChange={(e) => setTurnTimeout(Number(e.target.value))}
                className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-3 py-2 text-gray-800 dark:text-gray-100 dark:bg-neutral-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                aria-describedby="turn_timeout_help"
              />
              <p id="turn_timeout_help" className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Number of seconds each player has for their turn. Defaults to 5 seconds.
              </p>
            </div>

            <div>
              <label
                htmlFor="bot_fill_count"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Auto-fill bots on start
              </label>
              <select
                id="bot_fill_count"
                name="bot_fill_count"
                value={botFillCount}
                onChange={(e) => setBotFillCount(Number(e.target.value))}
                className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-3 py-2 dark:bg-neutral-800 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500"
              >
                <option value={0}>0 (Humans only)</option>
                {maxPlayers >= 2 && <option value={1}>1 bot</option>}
                {maxPlayers >= 3 && <option value={2}>2 bots</option>}
                {maxPlayers >= 4 && <option value={3}>3 bots</option>}
              </select>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                When you press Start, the game can add bots up to this amount (never above max players).
              </p>
            </div>

            <div>
              <label
                htmlFor="bot_difficulty"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Bot difficulty
              </label>
              <select
                id="bot_difficulty"
                name="bot_difficulty"
                value={botDifficulty}
                onChange={(e) => setBotDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
                className="w-full rounded-xl border border-gray-300 dark:border-gray-700 px-3 py-2 dark:bg-neutral-800 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            {/* Rules */}
            <div>
              <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Rules
              </span>

              <div className="space-y-2" role="group" aria-label="Rules">
                <label className="flex items-center gap-2">
                  <input
                    id="rule-pick_up_till_match"
                    name="rules[]"
                    type="checkbox"
                    checked={rules.includes("pick_up_till_match")}
                    onChange={() => handleRuleChange("pick_up_till_match")}
                    className="h-4 w-4 accent-indigo-600"
                    aria-checked={rules.includes("pick_up_till_match")}
                    value="pick_up_till_match"
                  />
                  <span className="text-gray-700 dark:text-gray-300">
                    Pick up cards until match
                  </span>
                </label>

                {/* 
                <label className="flex items-center gap-2">
                  <input
                    id="rule-skip"
                    name="rules[]"
                    data-testid="rule-skip"
                    type="checkbox"
                    checked={rules.includes("skip")}
                    onChange={() => handleRuleChange("skip")}
                    className="h-4 w-4 accent-indigo-600"
                    value="skip"
                  />
                  <span className="text-gray-700 dark:text-gray-300">Skip</span>
                </label>
                */}
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end">
              <button
                type="submit"
                data-testid="submit-room"
                className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
                aria-label="Create Room"
              >
                Create Room
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}