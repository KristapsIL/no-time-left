import React, { useState } from 'react';
import { updateRoomSettingsApi } from '@/utils/api';

type Player = { id: number; name?: string; role?: string };

type RoomRulesShape = {
  max_players: number;
  turn_timeout_seconds?: number;
  bot_fill_count?: number;
  rules: string[];
};

type Props = {
  winnerId: number | null | undefined;
  userId: number;
  isCreator: boolean;
  roomId: number;
  roomRules: RoomRulesShape;
  connectedPlayers: Player[];
  onPlayAgain: () => void;
  onLeave: () => void;
};

const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={onChange}
    className={`relative flex-shrink-0 h-6 w-10 rounded-full border transition-colors ${
      checked ? 'bg-cyan-500 border-cyan-400' : 'bg-zinc-600 border-zinc-500'
    }`}
  >
    <span
      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
        checked ? 'left-[22px]' : 'left-1'
      }`}
    />
  </button>
);

export const GameOverModal: React.FC<Props> = ({
  winnerId,
  userId,
  isCreator,
  roomId,
  roomRules,
  connectedPlayers,
  onPlayAgain,
  onLeave,
}) => {
  const [editing, setEditing] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState(roomRules.max_players);
  const [turnTimeout, setTurnTimeout] = useState(roomRules.turn_timeout_seconds ?? 5);
  const [botsEnabled, setBotsEnabled] = useState((roomRules.bot_fill_count ?? 0) > 0);
  const [rules, setRules] = useState<string[]>(roomRules.rules ?? []);
  const [saving, setSaving] = useState(false);

  const toggleRule = (rule: string) =>
    setRules((r) => (r.includes(rule) ? r.filter((x) => x !== rule) : [...r, rule]));

  const saveSettings = async () => {
    setSaving(true);
    try {
      await updateRoomSettingsApi(roomId, {
        max_players: maxPlayers,
        turn_timeout_seconds: turnTimeout,
        bot_fill_count: botsEnabled ? maxPlayers : 0,
        rules,
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const winner = connectedPlayers.find((p) => p.id === winnerId);
  const winnerName = winner?.name ?? (winnerId != null ? `Player ${winnerId}` : null);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-zinc-950 text-zinc-100 rounded-2xl p-6 w-full max-w-md shadow-xl border border-white/10">
        {!editing ? (
          <div className="space-y-5">
            <h2 className="text-2xl font-bold text-center">
              {winnerId === userId ? '🎉 You win!' : 'Game over'}
            </h2>

            {winnerId !== userId && winnerName && (
              <p className="text-zinc-300 text-center">Winner: {winnerName}</p>
            )}

            <div className="flex flex-wrap gap-2 justify-center">
              <button
                onClick={onPlayAgain}
                className="px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white font-semibold transition"
              >
                Play again
              </button>
              {isCreator && (
                <button
                  onClick={() => setEditing(true)}
                  className="px-5 py-2.5 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-white font-semibold transition"
                >
                  ⚙ Settings
                </button>
              )}
              <button
                onClick={onLeave}
                className="px-5 py-2.5 rounded-xl bg-red-700 hover:bg-red-600 text-white font-semibold transition"
              >
                Leave
              </button>
            </div>
            <p className="text-xs text-zinc-500 text-center">
              "Play again" resets so you can press Start.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <h3 className="text-lg font-bold">⚙ Edit Room Settings</h3>

            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Max Players</label>
              <select
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(Number(e.target.value))}
                className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm"
              >
                <option value={2}>2 Players</option>
                <option value={3}>3 Players</option>
                <option value={4}>4 Players</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Turn Timeout (seconds)</label>
              <input
                type="number"
                min={2}
                max={60}
                value={turnTimeout}
                onChange={(e) => setTurnTimeout(Number(e.target.value))}
                className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm"
              />
            </div>

            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-medium">Enable Bots</p>
                <p className="text-xs text-zinc-500">Auto-fill empty slots on start</p>
              </div>
              <Toggle checked={botsEnabled} onChange={() => setBotsEnabled((b) => !b)} />
            </div>

            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-medium">Pick up until match</p>
                <p className="text-xs text-zinc-500">Draw until a playable card</p>
              </div>
              <Toggle
                checked={rules.includes('pick_up_till_match')}
                onChange={() => toggleRule('pick_up_till_match')}
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={saveSettings}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="flex-1 py-2.5 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-zinc-200 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
