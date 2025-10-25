import React, { useState } from "react";
import AppLayout from '@/layouts/app-layout';
import { Head, router } from "@inertiajs/react";

export default function CreateRoom() {
  const [Name, setName] = useState<string>('');
  const [isPublic, setIsPublic] = useState(true);
  const [maxPlayers, setMaxPlayers] = useState(2);
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
      rules: rules,
    });
  };

  return (
    <AppLayout>
      <Head title="Create Room" />
      <div className="p-6 flex justify-center min-h-screen">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
              Create New Room
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Set up your game with custom rules and invite friends
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="bg-white dark:bg-neutral-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-8 space-y-6"
            data-testid="create-room-form"
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
                data-testid="room_name"
                type="text"
                value={Name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-gray-800 dark:text-gray-100 dark:bg-neutral-800 focus:ring-2 focus:ring-indigo-500 outline-none"
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
                  data-testid="public"
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
                data-testid="max_players"
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 dark:bg-neutral-800 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500"
                aria-label="Select max players"
              >
                <option value={2}>2 Players</option>
                <option value={3}>3 Players</option>
                <option value={4}>4 Players</option>
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
                    data-testid="rule-pick_up_till_match"
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
                className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
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