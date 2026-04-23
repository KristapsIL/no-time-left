<?php

namespace App\Http\Controllers;

use App\Models\Room;
use App\Models\RoomRules;
use App\Models\User;
use App\Http\Controllers\CardGameController;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class RoomController extends Controller
{
    public function createRoom(){
        return Inertia::render('cardgame/CreateRoom');
    }

    public function store(Request $request)
    {
        //Validē ievadītos datus no formas
        $validated = $request->validate([
            'room_name'             => ['required', 'min:3', 'max:255'],
            'public'                => ['required', 'boolean'],
            'max_players'           => ['required', 'integer', 'min:2', 'max:4'],
            'turn_timeout_seconds'  => ['nullable', 'integer', 'min:2', 'max:60'],
            'bot_fill_count'        => ['nullable', 'integer', 'min:0', 'max:4'],
            'bot_difficulty'        => ['nullable', 'in:easy,medium,hard'],
            'rules'                 => ['nullable', 'array'],
        ]);

        $maxPlayers = (int) $validated['max_players'];
        $botFillCount = (int) ($validated['bot_fill_count'] ?? 1);
        $botFillCount = max(0, min($botFillCount, max($maxPlayers - 1, 0)));
        $botDifficulty = $validated['bot_difficulty'] ?? 'medium';
         //Veic visu datubāzes darbību vienā transakcijā, lai kļūdas gadījumā nekas netiktu saglabāts daļēji
        return DB::transaction(function () use ($request, $validated, $botFillCount, $botDifficulty) {
            //Izveido jaunu istabu ar unikālu kodu un lietotāju, kas to izveidoja
            $room = Room::create([
                'room_name' => $validated['room_name'],
                'room_code' => $this->uniqueCode(),
                'created_by'=> $request->user()->id,
            ]);
             //Izveido šai istabai atbilstošus noteikumus
            RoomRules::create([
                'room_id'             => $room->id,
                'public'              => $validated['public'],
                'max_players'         => $validated['max_players'],
                'turn_timeout_seconds'=> $validated['turn_timeout_seconds'] ?? 5,
                'bot_fill_count'      => $botFillCount,
                'bot_difficulty'      => $botDifficulty,
                'rules'               => $validated['rules'] ?? [],
            ]);

            DB::table('room_user')->updateOrInsert(
                ['user_id' => $request->user()->id],
                [
                    'room_id'    => $room->id,
                    'updated_at' => now(),
                    'created_at' => now(),
                ]
            );

            //Pēc veiksmīgas izveides pāradresē lietotāju uz spēles galda lapu
            return redirect()->route('board', ['roomId' => $room->id]);
        });
    }

    public function quickAiRoom(Request $request)
    {
        return DB::transaction(function () use ($request) {
            $room = Room::create([
                'room_name' => 'AI Duel ' . now()->format('H:i:s'),
                'room_code' => $this->uniqueCode(),
                'created_by'=> $request->user()->id,
            ]);

            RoomRules::create([
                'room_id'             => $room->id,
                'public'              => false,
                'max_players'         => 2,
                'turn_timeout_seconds'=> 5,
                'bot_fill_count'      => 1,
                'bot_difficulty'      => 'medium',
                'rules'               => [],
            ]);

            DB::table('room_user')->updateOrInsert(
                ['user_id' => $request->user()->id],
                [
                    'room_id'    => $room->id,
                    'updated_at' => now(),
                    'created_at' => now(),
                ]
            );

            return redirect()->route('board', ['roomId' => $room->id]);
        });
    }


    private function uniqueCode(): string
    {
        do {
            $code = strtoupper(Str::random(6));
        } while (Room::where('room_code', $code)->exists());

        return $code;
    }
    /**
     * Metode, kas atrod visas spēļu istabas un nodod tās React komponentēm,
     * izmantojot Inertia.js, bez nepieciešamības veidot REST API.
     */
    public function findRoom(){
        // Exclude rooms with finished games and AI-only quick-duel rooms.
        $rooms = Room::with(['rules', 'game', 'players'])
            ->where('room_name', 'not like', 'AI Duel %')
            ->where(function ($q) {
                $q->whereDoesntHave('game')
                  ->orWhereHas('game', fn ($gq) => $gq->where('game_status', '!=', 'finished'));
            })
            ->get();
        return Inertia::render('cardgame/FindRoom', ['rooms' => $rooms]);
    }

    public function joinRoomByCode(Request $request, string $code)
    {
        $code = strtoupper(trim($code));
        $room = Room::where('room_code', $code)->first();

        if (!$room) {
            return redirect()->route('findRoom')
                ->with('error', "No room found with code \"{$code}\".");
        }

        return $this->joinRoom($request, $room->id);
    }

    public function joinRoom(Request $request, int $roomId)
    {
        $userId = $request->user()->id;
        $room = Room::with(['game', 'players', 'rules'])->findOrFail($roomId);

        $isExistingPlayer = $room->players()->where('user_id', $userId)->exists();

        if ($isExistingPlayer) {
            return redirect()->route('board', ['roomId' => $roomId])
                ->with('success', 'Welcome back! You have rejoined the game.');
        }

        // Mid-match join: take over a bot's seat and hand
        if ($room->isGameActive()) {
            $botToReplace = $room->players()
                ->where('users.role', 'bot')
                ->orderBy('room_user.created_at')
                ->first();

            if (!$botToReplace) {
                return redirect()->route('findRoom')
                    ->with('error', 'Cannot join room: Game is in progress and no bot slots are available.');
            }

            $botId = (int) $botToReplace->id;
            $newCurrentTurn = null;

            DB::transaction(function () use ($roomId, $userId, $botId, &$newCurrentTurn) {
                $room = Room::with(['game', 'players'])->lockForUpdate()->findOrFail($roomId);
                $game = $room->game;

                // Transfer bot's hand to the new player
                $hands = $game->player_hands ?? [];
                $botHand = $hands[(string) $botId] ?? [];
                unset($hands[(string) $botId]);
                $hands[(string) $userId] = $botHand;

                // Hand over the turn if the bot was up next
                $currentTurn = (int) $game->current_turn;
                if ($currentTurn === $botId) {
                    $currentTurn = $userId;
                }
                $newCurrentTurn = $currentTurn;

                $game->player_hands = $hands;
                $game->current_turn = $currentTurn;
                $game->save();

                // Swap bot → real player in room_user
                DB::table('room_user')->where('user_id', $botId)->delete();
                DB::table('room_user')->updateOrInsert(
                    ['user_id' => $userId],
                    [
                        'room_id'    => $roomId,
                        'updated_at' => now(),
                        'created_at' => now(),
                    ]
                );

                // Send the hand to the new player
                $handCounts = collect($hands)->map(fn($h) => count($h))->toArray();
                broadcast(new \App\Events\HandSynced(
                    roomId: $roomId,
                    userId: $userId,
                    hand: $botHand,
                    handCounts: $handCounts,
                    deckCount: count($game->deck ?? []),
                    usedCards: $game->used_cards ?? [],
                    turnPlayerId: $currentTurn,
                ));
            });

            return redirect()->route('board', ['roomId' => $roomId])
                ->with('success', 'You joined the ongoing game, taking over a bot\'s hand!');
        }

        // Pre-game join
        $currentPlayerCount = $room->players()->count();
        $maxPlayers = $room->rules->max_players ?? 4;

        if ($currentPlayerCount >= $maxPlayers) {
            $botToReplace = $room->players()
                ->where('users.role', 'bot')
                ->orderBy('room_user.created_at')
                ->first();

            if ($botToReplace) {
                $room->players()->detach($botToReplace->id);
                $room->load('players');
            } else {
                return redirect()->route('findRoom')
                    ->with('error', 'Cannot join room: Room is full.');
            }
        }

        if ($room->game && $room->game->isFinished()) {
            return redirect()->route('findRoom')
                ->with('error', 'Cannot join room: Game has finished.');
        }

        DB::table('room_user')->updateOrInsert(
            ['user_id' => $userId],
            [
                'room_id'    => $roomId,
                'updated_at' => now(),
                'created_at' => now(),
            ]
        );

        return redirect()->route('board', ['roomId' => $roomId])
            ->with('success', 'Successfully joined the room!');
    }


    public function leaveRoom(Request $request, $roomId)
    {
        $userId = (int) $request->user()->id;
        $runBots = false;

        DB::transaction(function () use ($userId, $roomId, &$runBots) {
            $room = Room::with(['game', 'players', 'rules'])->lockForUpdate()->findOrFail($roomId);
            $game = $room->game;

            if ($game && $game->isActive()) {
                // Replace the leaving player with a bot so the game can continue.
                $bot = User::query()->forceCreate([
                    'name'              => 'Bot ' . strtoupper(Str::random(4)),
                    'role'              => 'bot',
                    'email'             => 'bot+' . Str::uuid() . '@no-time-left.local',
                    'email_verified_at' => now(),
                    'password'          => Hash::make(Str::random(32)),
                ]);

                $hands = $game->player_hands ?? [];
                $leavingHand = $hands[(string) $userId] ?? [];
                unset($hands[(string) $userId]);
                $hands[(string) $bot->id] = $leavingHand;

                // Transfer the turn to the bot if it was the leaving player's turn.
                if ((int) $game->current_turn === $userId) {
                    $game->current_turn = $bot->id;
                    $runBots = true;
                }

                $game->player_hands = $hands;
                $game->save();

                DB::table('room_user')->where('user_id', $userId)->where('room_id', $roomId)->delete();
                DB::table('room_user')->insert([
                    'user_id'    => $bot->id,
                    'room_id'    => $roomId,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            } else {
                // Not an active game — just remove the player.
                DB::table('room_user')->where('user_id', $userId)->where('room_id', $roomId)->delete();
            }

            // If no real human players remain after leaving, delete the room and orphaned bots.
            $remainingBotIds = DB::table('room_user')
                ->join('users', 'users.id', '=', 'room_user.user_id')
                ->where('room_user.room_id', $roomId)
                ->where('users.role', 'bot')
                ->pluck('users.id')
                ->toArray();

            $humanCount = DB::table('room_user')
                ->join('users', 'users.id', '=', 'room_user.user_id')
                ->where('room_user.room_id', $roomId)
                ->where('users.role', '!=', 'bot')
                ->count();

            if ($humanCount === 0) {
                $runBots = false;
                $room->delete(); // cascades to card_games and room_user
                if (!empty($remainingBotIds)) {
                    User::destroy($remainingBotIds);
                }
            }
        });

        // Trigger bot turns outside the transaction to avoid deadlocks.
        if ($runBots) {
            (new CardGameController)->runBotTurns($roomId);
        }

        return redirect()->route('findRoom');
    }
}
