import React, { useEffect, useState } from "react";
import AppLayout from '@/layouts/app-layout';
import { Head, router } from "@inertiajs/react";

export default function CreateRoom() {
  const [Name, setName] = useState<string>('');
  const [isPublic, setIsPublic] = useState(true);
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [turnTimeout, setTurnTimeout] = useState(5);
  const [botsEnabled, setBotsEnabled] = useState(true);
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
      bot_fill_count: botsEnabled ? botFillCount : 0,
      bot_difficulty: botsEnabled ? botDifficulty : 'medium',
      rules: rules,
    });
  };

  return (
    <AppLayout>
      <Head title="Create Room" />
      <div className="relative min-h-[100dvh] overflow-hidden p-4 md:p-8">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-16 top-0 h-64 w-64 rounded-full bg-cyan-300/30 blur-3xl dark:bg-cyan-500/20" />
          <div className="absolute right-[-30px] top-1/3 h-72 w-72 rounded-full bg-emerald-300/25 blur-3xl dark:bg-emerald-400/15" />
          <div className="absolute bottom-[-80px] left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-amber-300/25 blur-3xl dark:bg-amber-500/10" />
        </div>

        <div className="relative mx-auto w-full max-w-3xl">
          <div className="mb-8 text-center">
            <p className="inline-flex rounded-full border border-black/10 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-700 dark:border-white/15 dark:bg-white/10 dark:text-zinc-200">
              Room Setup
            </p>
            <h1 className="mt-4 text-4xl font-extrabold text-zinc-900 dark:text-zinc-100 md:text-5xl" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Build Your Table
            </h1>
            <p className="mt-2 text-zinc-600 dark:text-zinc-300">
              Dial in pace, player count, bots, and rules before the chaos starts.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-3xl border border-black/10 bg-white/85 p-5 shadow-2xl backdrop-blur md:p-8 dark:border-white/10 dark:bg-[#0d1621]/85"
            aria-label="Create Room Form"
          >
            <div className="grid gap-6 md:grid-cols-2">

            {/* Room Name */}
            <div className="md:col-span-2">
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
                className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none transition focus:ring-2 focus:ring-cyan-500 dark:border-gray-700 dark:bg-neutral-900 dark:text-gray-100"
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
              <label className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-white/5">
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
                className="w-full rounded-2xl border border-gray-300 bg-white px-3 py-3 text-gray-900 focus:ring-2 focus:ring-cyan-500 dark:border-gray-700 dark:bg-neutral-900 dark:text-gray-100"
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
                className="w-full rounded-2xl border border-gray-300 bg-white px-3 py-3 text-gray-900 outline-none focus:ring-2 focus:ring-cyan-500 dark:border-gray-700 dark:bg-neutral-900 dark:text-gray-100"
                aria-describedby="turn_timeout_help"
              />
              <p id="turn_timeout_help" className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Number of seconds each player has for their turn. Defaults to 5 seconds.
              </p>
            </div>

            <div className="md:col-span-2 rounded-2xl border border-black/10 bg-black/[0.03] p-4 dark:border-white/10 dark:bg-white/5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Enable Bots</p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-300">Toggle AI autofill for your room</p>
                </div>
                <button
                  type="button"
                  onClick={() => setBotsEnabled((prev) => !prev)}
                  className={`relative h-8 w-16 rounded-full border transition ${botsEnabled ? 'bg-cyan-500 border-cyan-400' : 'bg-zinc-300 border-zinc-400 dark:bg-zinc-700 dark:border-zinc-600'}`}
                  aria-pressed={botsEnabled}
                >
                  <span
                    className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition ${botsEnabled ? 'left-9' : 'left-1'}`}
                  />
                </button>
              </div>

              {botsEnabled && (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
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
                      className="w-full rounded-2xl border border-gray-300 bg-white px-3 py-3 text-gray-900 focus:ring-2 focus:ring-cyan-500 dark:border-gray-700 dark:bg-neutral-900 dark:text-gray-100"
                    >
                      <option value={0}>0 (Humans only)</option>
                      {maxPlayers >= 2 && <option value={1}>1 bot</option>}
                      {maxPlayers >= 3 && <option value={2}>2 bots</option>}
                      {maxPlayers >= 4 && <option value={3}>3 bots</option>}
                    </select>
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
                      className="w-full rounded-2xl border border-gray-300 bg-white px-3 py-3 text-gray-900 focus:ring-2 focus:ring-cyan-500 dark:border-gray-700 dark:bg-neutral-900 dark:text-gray-100"
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Rules */}
            <div className="md:col-span-2">
              <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Rules
              </span>

              <div className="space-y-2 rounded-2xl border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/5" role="group" aria-label="Rules">
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

                <p className="text-xs text-zinc-500 dark:text-zinc-400">More rules can be added here later.</p>
              </div>
            </div>

            {/* Submit Button */}
            <div className="md:col-span-2 flex justify-end pt-2">
              <button
                type="submit"
                data-testid="submit-room"
                className="px-7 py-3 rounded-2xl bg-zinc-900 text-white font-semibold shadow-lg transition hover:-translate-y-0.5 hover:bg-black dark:bg-cyan-400 dark:text-zinc-900 dark:hover:bg-cyan-300"
                aria-label="Create Room"
              >
                Create Room
              </button>
            </div>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}