import React, { useState } from "react";
import AppLayout from '@/layouts/app-layout';
import { Head, router } from "@inertiajs/react";

const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={onChange}
    className={`relative flex-shrink-0 h-7 w-12 rounded-full border transition-colors ${
      checked ? 'bg-cyan-500 border-cyan-400' : 'bg-zinc-300 border-zinc-400 dark:bg-zinc-700 dark:border-zinc-600'
    }`}
  >
    <span
      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
        checked ? 'left-[26px]' : 'left-1'
      }`}
    />
  </button>
);

export default function CreateRoom() {
  const [Name, setName] = useState<string>('');
  const [isPublic, setIsPublic] = useState(true);
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [turnTimeout, setTurnTimeout] = useState(5);
  const [botsEnabled, setBotsEnabled] = useState(true);
  const [rules, setRules] = useState<string[]>([]);

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
      bot_fill_count: botsEnabled ? maxPlayers : 0,
      bot_difficulty: 'medium',
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
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-black/10 bg-black/[0.03] px-4 py-3 dark:border-white/10 dark:bg-white/5">
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Public Room</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Visible in the room browser</p>
              </div>
              <Toggle checked={isPublic} onChange={() => setIsPublic((p) => !p)} />
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

            {/* Bots */}
            <div className="md:col-span-2 flex items-center justify-between gap-3 rounded-2xl border border-black/10 bg-black/[0.03] px-4 py-3 dark:border-white/10 dark:bg-white/5">
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Enable Bots</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Auto-fill empty slots on start. Real players can take over mid-match.</p>
              </div>
              <Toggle checked={botsEnabled} onChange={() => setBotsEnabled((p) => !p)} />
            </div>

            {/* Rules */}
            <div className="md:col-span-2">
              <p className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Rules</p>
              <div className="space-y-2 rounded-2xl border border-black/10 bg-black/[0.03] p-3 dark:border-white/10 dark:bg-white/5" role="group" aria-label="Rules">
                <div className="flex items-center justify-between gap-3 px-1 py-0.5">
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Pick up until match</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Keep drawing until you have a playable card</p>
                  </div>
                  <Toggle checked={rules.includes('pick_up_till_match')} onChange={() => handleRuleChange('pick_up_till_match')} />
                </div>
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