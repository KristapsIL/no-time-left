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

class RoomController extends Controller
{
    // Atgriež istabas izveides React komponentu — lietotājs var konfigurēt noteikumus un izveidot jaunu istabu
    public function createRoom(){
        // Renderē React lapu "CreateRoom" bez papildu props, jo forma pati par sevi ir patstāvīga un neizsauc datus
        return Inertia::render('cardgame/CreateRoom');
    }

    // Apstrādā formu un izveido jaunu istabu ar noteikumiem
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
            // Izveido istabu ar unikālu kodu
            $room = Room::create([
                'room_name' => $validated['room_name'],
                'room_code' => $this->uniqueCode(),
                'created_by'=> $request->user()->id,
            ]);
             // Izveido noteikumus šai istabai
            RoomRules::create([
                'room_id'             => $room->id,
                'public'              => $validated['public'],
                'max_players'         => $validated['max_players'],
                'turn_timeout_seconds'=> $validated['turn_timeout_seconds'] ?? 5,
                'bot_fill_count'      => $botFillCount,
                'bot_difficulty'      => $botDifficulty,
                'rules'               => $validated['rules'] ?? [],
            ]);

            // Pievienojas istabai kā pirmais spēlētājs
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

    // Ātri izveido 1v1 istabu pret botu — nekonfigurējams, aiziet uzreiz
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


    // Ģenerē unikālu 6 zimķu istabas kodu
    private function uniqueCode(): string
    {
        do {
            $code = strtoupper(Str::random(6));
        } while (Room::where('room_code', $code)->exists());

        return $code;
    }
    // Atrod publiskās istabas un nodod tās FindRoom lapai
    public function findRoom(){
        // Ielādē saistītos datus: noteikumi, spēle, spēlētāji — efektīvai datu pasniegšanai uz front-end
        // Filtrē pēc nosaukuma — neiekļauj "AI Duel" istabas (automātiski izveidotas ātrajām 1v1 duelem pret botu)
        // Un filtrē pēc spēles statusa — rāda istabas, kurām NAV spēles, VAI kurām ir spēle bet tā NAV 'finished'
        $rooms = Room::with(['rules', 'game', 'players'])
            ->where('room_name', 'not like', 'AI Duel %')
            ->where(function ($q) {
                // Ietver istabas bez spēles (tikai gaidīšanas stāvoklis)
                $q->whereDoesntHave('game')
                  // VAI istabas ar spēli, bet statuss nav 'finished' (aktīva vai pausēta)
                  ->orWhereHas('game', fn ($gq) => $gq->whereNotIn('game_status', ['finished']));
            })
            ->get();
        // Nodod istabas React komponentei "FindRoom" kā masīvu ar pieejamajām istabām izmantojot Inertia
        return Inertia::render('cardgame/FindRoom', ['rooms' => $rooms]);
    }

    // Pievienojas istabai pēc koda — nostrādā ar joinRoom
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

    // Pievieno spēlētāju istabai — atbalsta re-join, pauziēto spēli un priekgājienu
    public function joinRoom(Request $request, int $roomId)
    {
        $userId = $request->user()->id;
        $room = Room::with(['game', 'players', 'rules'])->findOrFail($roomId);

        $isExistingPlayer = $room->players()->where('user_id', $userId)->exists();

        if ($isExistingPlayer) {
            return redirect()->route('board', ['roomId' => $roomId])
                ->with('success', 'Welcome back!');
        }

        $game = $room->game;

        // Paused game: allow a new player to fill the open slot and resume
        if ($game && $game->isPaused()) {
            $currentCount = $room->players()->count();
            $maxPlayers   = $room->rules->max_players ?? 4;

            if ($currentCount >= $maxPlayers) {
                return redirect()->route('findRoom')
                    ->with('error', 'Cannot join: the room is full.');
            }

            DB::transaction(function () use ($roomId, $userId, $room) {
                $room = Room::with(['game', 'players' => fn ($q) => $q->orderBy('room_user.created_at'), 'rules'])
                    ->lockForUpdate()
                    ->findOrFail($roomId);
                $game = $room->game;

                // Add player to room
                DB::table('room_user')->insert([
                    'user_id'    => $userId,
                    'room_id'    => $roomId,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                // Deal them cards from the deck
                $deck  = $game->deck ?? [];
                $cardsPerPlayer = $room->rules->cards_per_player ?? 6;
                $newHand = array_splice($deck, 0, min($cardsPerPlayer, count($deck)));

                $hands = $game->player_hands ?? [];
                $hands[(string) $userId] = $newHand;

                // Resume game
                $game->player_hands = $hands;
                $game->deck         = array_values($deck);
                $game->game_status  = 'in_progress';
                $game->save();

                $handCounts = collect($hands)->map(fn ($h) => count($h))->toArray();
                $players    = $room->players()->orderBy('room_user.created_at')
                    ->get()->push(User::find($userId))
                    ->map(fn ($p) => ['id' => (int) $p->id, 'name' => $p->name, 'role' => $p->role ?? 'player'])
                    ->values()->toArray();

                // Send the new player their hand
                broadcast(new \App\Events\HandSynced(
                    roomId: $roomId,
                    userId: $userId,
                    hand: $newHand,
                    handCounts: $handCounts,
                    deckCount: count($deck),
                    usedCards: $game->used_cards ?? [],
                    turnPlayerId: $game->current_turn,
                ));

                // Tell everyone the game resumed
                broadcast(new \App\Events\GameResumed(
                    roomId: $roomId,
                    handCounts: $handCounts,
                    deckCount: count($deck),
                    usedCards: $game->used_cards ?? [],
                    currentTurn: $game->current_turn,
                    players: $players,
                ));
            });

            return redirect()->route('board', ['roomId' => $roomId])
                ->with('success', 'Game resumed!');
        }

        // Active game — no longer allowing mid-match joins
        if ($game && $game->isActive()) {
            return redirect()->route('findRoom')
                ->with('error', 'Cannot join room: game is already in progress.');
        }

        // Pre-game join
        $currentPlayerCount = $room->players()->count();
        $maxPlayers = $room->rules->max_players ?? 4;

        if ($currentPlayerCount >= $maxPlayers) {
            $gameIsWaiting = !$game || $game->isWaiting();
            $botToReplace = $gameIsWaiting
                ? $room->players()->where('users.role', 'bot')->orderBy('room_user.created_at')->first()
                : null;

            if ($botToReplace) {
                DB::transaction(function () use ($roomId, $userId, $botToReplace) {
                    DB::table('room_user')->where('room_id', $roomId)->where('user_id', $botToReplace->id)->delete();
                    User::whereKey($botToReplace->id)->delete();

                    DB::table('room_user')->updateOrInsert(
                        ['user_id' => $userId],
                        [
                            'room_id'    => $roomId,
                            'updated_at' => now(),
                            'created_at' => now(),
                        ]
                    );
                });

                return redirect()->route('board', ['roomId' => $roomId])
                    ->with('success', 'Successfully joined the room!');
            }
            return redirect()->route('findRoom')
                ->with('error', 'Cannot join room: room is full.');
        }

        if ($game && $game->isFinished()) {
            return redirect()->route('findRoom')
                ->with('error', 'Cannot join room: game has finished.');
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


    // Spēlētājs atstāj istabu — aptur spēli ja tā rit, vai dzēš istabu ja nav citu
    public function leaveRoom(Request $request, $roomId)
    {
        $userId   = (int) $request->user()->id;
        $leaverName = $request->user()->name ?? "Player {$userId}";

        DB::transaction(function () use ($userId, $roomId, $leaverName) {
            $room = Room::with(['game', 'players', 'rules'])->lockForUpdate()->findOrFail($roomId);
            $game = $room->game;

            if ($game && $game->isActive()) {
                // Remove the leaver's hand
                $hands = $game->player_hands ?? [];
                unset($hands[(string) $userId]);
                $game->player_hands = $hands;

                // Advance the turn away from the leaver if it was theirs
                if ((int) $game->current_turn === $userId) {
                    // Find next human in current rotation (before detach so the list is intact)
                    $orderedIds = $room->players()
                        ->orderBy('room_user.created_at')
                        ->pluck('users.id')
                        ->filter(fn ($id) => (int) $id !== $userId)
                        ->values()
                        ->toArray();
                    $game->current_turn = $orderedIds[0] ?? null;
                }

                // Pause the game
                $game->game_status = 'paused';
                $game->save();

                // Remove from room
                DB::table('room_user')->where('user_id', $userId)->where('room_id', $roomId)->delete();

                // Notify remaining players
                broadcast(new \App\Events\GamePaused($roomId, $leaverName));
            } else {
                // Waiting / finished — just remove
                DB::table('room_user')->where('user_id', $userId)->where('room_id', $roomId)->delete();
            }

            // If no human players remain, delete the whole room
            $humanCount = DB::table('room_user')
                ->join('users', 'users.id', '=', 'room_user.user_id')
                ->where('room_user.room_id', $roomId)
                ->where('users.role', '!=', 'bot')
                ->count();

            if ($humanCount === 0) {
                $botIds = $room->players()->where('users.role', 'bot')->pluck('users.id');
                $room->delete();
                if ($botIds->isNotEmpty()) {
                    User::whereIn('id', $botIds)->delete();
                }
            }
        });

        return redirect()->route('findRoom');
    }

    // Admins var dzēst jebkuru istabu — notīra arī botus un spēles datus
    public function destroy(Request $request, int $roomId)
    {
        if ($request->user()->role !== 'admin') {
            abort(403, 'Only admins can delete rooms.');
        }

        $room = Room::with('players')->findOrFail($roomId);

        DB::transaction(function () use ($room) {
            $botIds = $room->players()->where('users.role', 'bot')->pluck('users.id');
            $room->delete();
            if ($botIds->isNotEmpty()) {
                User::whereIn('id', $botIds)->delete();
            }
        });

        return redirect()->route('findRoom')->with('success', 'Room deleted.');
    }
}
