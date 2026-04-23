import React, { useState } from 'react';
import { updateRoomSettingsApi } from '@/utils/api';
import { PlayerAvatar } from '@/components/PlayerAvatar';

type Player = { id: number; name?: string; role?: string; avatar_url?: string | null };

type RoomRulesShape = {
  max_players: number;
  turn_timeout_seconds?: number;
  bot_fill_count?: number;
  rules: string[];
};

type Props = {
  players: Player[];
  userId: number;
  isCreator: boolean;
  isStartingGame: boolean;
  roomCode: string;
  onStart: () => void;
  onLeave: () => void;
  isChatOpen: boolean;
  toggleChat: () => void;
  roomId: number;
  roomRules: RoomRulesShape;
  onSaved?: () => void;
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

export const WaitingLobby: React.FC<Props> = ({
  players,
  userId,
  isCreator,
  isStartingGame,
  roomCode,
  onStart,
  onLeave,
  isChatOpen,
  toggleChat,
  roomId,
  roomRules,
  onSaved,
}) => {
  const humanPlayers = players.filter((p) => p.role !== 'bot');

  const [showSettings, setShowSettings] = useState(false);
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
      setShowSettings(false);
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-950 border border-white/10 rounded-2xl p-6 w-full max-w-sm text-zinc-100 space-y-5 shadow-2xl max-h-[90dvh] overflow-y-auto">
        {/* Room code */}
        <div className="text-center">
          <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Room Code</p>
          <code className="text-3xl font-mono font-bold tracking-widest text-cyan-400">{roomCode}</code>
        </div>

        {/* Player list */}
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">
            Players ({humanPlayers.length})
          </p>
          <ul className="space-y-1.5">
            {humanPlayers.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/5"
              >
                <PlayerAvatar id={p.id} name={p.name} size={26} avatarUrl={p.avatar_url} />
                <span className="text-sm truncate">{p.name ?? `Player ${p.id}`}</span>
                {p.id === userId && (
                  <span className="ml-auto text-[10px] text-cyan-400 font-semibold uppercase tracking-wide flex-shrink-0">
                    You
                  </span>
                )}
              </li>
            ))}
            {humanPlayers.length === 0 && (
              <li className="text-zinc-500 text-sm text-center py-2">No players yet…</li>
            )}
          </ul>
        </div>

        {/* Creator: room settings */}
        {isCreator && (
          <div className="border border-white/10 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowSettings((s) => !s)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-zinc-300 hover:bg-white/5 transition"
            >
              <span>⚙ Room Settings</span>
              <span className="text-zinc-500 text-xs">{showSettings ? '▲' : '▼'}</span>
            </button>

            {showSettings && (
              <div className="px-4 pb-4 space-y-4 border-t border-white/10 pt-4">
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

                <div className="flex items-center justify-between py-1">
                  <div>
                    <p className="text-sm font-medium">2s are +2</p>
                    <p className="text-xs text-zinc-500">Playing a 2 forces the next player to pick up 2</p>
                  </div>
                  <Toggle
                    checked={rules.includes('plus_two')}
                    onChange={() => toggleRule('plus_two')}
                  />
                </div>

                {rules.includes('plus_two') && (
                  <div className="flex items-center justify-between py-1 pl-3 border-l border-cyan-800/40">
                    <div>
                      <p className="text-sm font-medium">Stacking</p>
                      <p className="text-xs text-zinc-500">Play a 2 onto a +2 to chain (+4, +6…)</p>
                    </div>
                    <Toggle
                      checked={rules.includes('stacking')}
                      onChange={() => toggleRule('stacking')}
                    />
                  </div>
                )}

                <div className="flex items-center justify-between py-1">
                  <div>
                    <p className="text-sm font-medium">Double deck</p>
                    <p className="text-xs text-zinc-500">Play with 104 cards (two decks shuffled)</p>
                  </div>
                  <Toggle
                    checked={rules.includes('double_deck')}
                    onChange={() => toggleRule('double_deck')}
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
                    onClick={() => setShowSettings(false)}
                    className="flex-1 py-2.5 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-zinc-200 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Chat toggle */}
        <button
          type="button"
          onClick={toggleChat}
          className={`w-full py-2 rounded-xl text-sm font-medium transition ${
            isChatOpen
              ? 'bg-cyan-700 text-white hover:bg-cyan-600'
              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
          }`}
        >
          💬 {isChatOpen ? 'Close Chat' : 'Open Chat'}
        </button>

        {/* Start / waiting */}
        {isCreator ? (
          <button
            type="button"
            onClick={onStart}
            disabled={isStartingGame}
            className="w-full py-3 rounded-xl bg-green-500 text-white font-bold text-base hover:bg-green-400 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-900/40"
          >
            {isStartingGame ? 'Starting…' : '▶ Start Game'}
          </button>
        ) : (
          <div className="text-center py-2 text-zinc-400 text-sm">
            Waiting for the host to start…
          </div>
        )}

        {/* Leave */}
        <button
          type="button"
          onClick={onLeave}
          className="w-full py-2 rounded-xl bg-zinc-800 text-zinc-400 text-sm hover:bg-zinc-700 hover:text-zinc-200 transition"
        >
          Leave Room
        </button>
      </div>
    </div>
  );
};
