<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Collection;

use App\Models\Room;
use App\Models\RoomRules;
use App\Models\CardGame;

use App\Events\GameStarted;
use App\Events\CardPlayed;
use App\Events\HandSynced;

class CardGameController extends Controller
{



    public function board(Request $request, int $roomId)
    {
        $user = $request->user();

        // 1) Authorization: user must be in the room
        $inRoom = $user->rooms()->where('rooms.id', $roomId)->exists();
        if (! $inRoom) {
            return redirect()
                ->route('findRoom')
                ->with('error', 'Join the room before opening the board.');
        }

        // 2) Ensure "room + game" atomically; no duplicate CardGame under concurrency
        [$room, $game] = DB::transaction(function () use ($roomId) {
            // Lock the room row so two users can't create two games
            $room = Room::query()
                ->whereKey($roomId)
                ->with(['players', 'rules'])    // eager-load for the UI
                ->lockForUpdate()
                ->firstOrFail();

            // unique index on card_games.room_id recommended (see migration below)
            $game = CardGame::firstOrCreate(
                ['room_id' => $room->id],
                [
                    'deck'        => $this->buildDeck(),
                    'game_status' => 'waiting',
                ]
            );

            // If game existed but deck is empty (e.g., manual DB changes), re-seed while waiting
            if ($game->game_status === 'waiting' && empty($game->deck)) {
                $game->deck = $this->buildDeck();
                $game->save();
            }

            return [$room, $game];
        });

        // 3) Privacy-preserving payload for the client
        $playerHands = $game->player_hands ?? [];
        $myHand      = $playerHands[$user->id] ?? [];
        $handCounts  = collect($playerHands)->map(fn ($cards) => is_array($cards) ? count($cards) : 0);

        // If your Room model has an accessor getCodeAttribute() returning room_code,
        // the "code" field will be present automatically. Alternatively, map it explicitly below.
        $roomArray = $room->toArray();
        $roomArray['code'] = $room->room_code; // remove if you added an accessor

        return Inertia::render('cardgame/Board', [
            'room'       => $roomArray,                 // contains id, code, rules, players
            'deck'       => $game->deck ?? [],
            'usedCards'  => $game->used_cards ?? [],
            'handCounts' => $handCounts,                // { userId: count }
            'myHand'     => array_values($myHand),      // only my hand
            'userId'     => $user->id,
        ]);
    }


    public function shuffle(int $roomId): RedirectResponse
    {
        $room = Room::with('game')->findOrFail($roomId);
        $game = $room->game;

        if (!$game) {
            return back()->with('error', 'Game not initialized for this room.');
        }

        $deck = $game->deck ?? [];

        shuffle($deck);

        $game->deck = $deck;
        $game->save();

        return back();
    }


    public function reset(int $roomId): RedirectResponse
    {
        $room = Room::with('game')->findOrFail($roomId);
        $game = $room->game;

        if (!$game) {
            return back()->with('error', 'Game not initialized for this room.');
        }

        $game->deck = $this->buildDeck();
        $game->used_cards = [];
        $game->player_hands = [];
        $game->current_turn = null;
        $game->game_status = 'waiting';
        $game->game_started_at = null;
        $game->save();

        return back();
    }

    private function buildDeck(): array
    {
        $suits = ['♠', '♥', '♦', '♣'];
        $faces = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
        $deck  = [];

        foreach ($suits as $suit) {
            foreach ($faces as $face) {
                $deck[] = $face . '-' . $suit;
            }
        }

        return $deck;
    }

    private function validateStartConditions(Room $room, int $userId): void
    {
        $isMember = $room->players()->whereKey($userId)->exists();
        if (!$isMember) {
            throw new \Exception('You must join this room before starting the game.');
        }

        if ($room->game && $room->game->game_status === 'in_progress') {
            throw new \Exception('Game already in progress.');
        }

        if ($room->players()->count() < 2) {
            throw new \Exception('At least 2 players required to start the game.');
        }
    }

    private function dealCards(array &$deck, Collection $players, int $cardsPerPlayer): array
    {
        $hands = [];

        foreach ($players as $player) {
            $dealt = array_splice($deck, 0, $cardsPerPlayer);
            $hands[(string) $player->id] = array_values($dealt);
        }

        return $hands;
    }
    private function initializeGame(CardGame $game, array $hands, array $deck, array $usedCards, int $firstPlayerId): void
    {
        $game->fill([
            'deck'            => array_values($deck),
            'used_cards'      => array_values($usedCards),
            'player_hands'    => $hands,
            'game_status'     => 'in_progress',
            'current_turn'    => $firstPlayerId,
            'game_started_at' => now(),
        ])->save();
    }

    public function startGame(Request $request, int $roomId){
        $userId = $request->user()->id;

        [$game, $hands, $deck, $usedCards, $players] = DB::transaction(function () use ($roomId, $userId) {
            $room = Room::with(['players', 'game', 'rules'])->lockForUpdate()->findOrFail($roomId);

            // Validācija
            $this->validateStartConditions($room, $userId);

            // Spēles instance
            $game = $room->game ?? new CardGame(['room_id' => $room->id]);

            // Kavas sagatavošana
            $deck = $game->deck ?: $this->buildDeck();
            shuffle($deck);

            $cardsPerPlayer = $room->rules->cards_per_player ?? 6;

            // Spēlētāju kāršu sadale
            $players = $room->players()->orderBy('room_user.created_at')->get();
            $hands = $this->dealCards($deck, $players, $cardsPerPlayer);

            // Pirmā kārts uz galda
            $firstCard = array_shift($deck);
            $usedCards = [$firstCard];

            // Spēles inicializācija
            $this->initializeGame($game, $hands, $deck, $usedCards, $players->first()->id);

            return [$game, $hands, $deck, $usedCards, $players];
        });

        // Rokas izmēri
        $handCounts = collect($hands)->map(fn($h) => count($h))->toArray();
        $deckCount = count($deck);

        // Broadcast: spēle sākta
        broadcast(new GameStarted(
            roomId:       $game->room_id,
            handCounts:   $handCounts,
            usedCards:    $usedCards,
            turnPlayerId: $game->current_turn,
            deckCount:    $deckCount
        ));

        // Broadcast: katram spēlētājam viņa roka
        foreach ($players as $p) {
            broadcast(new HandSynced(
                userId: $p->id,
                hand:   $hands[(string)$p->id]
            ));
        }
        return response()->json([
            'success'      => true,
            'hand'         => $actingHand ?? null,
            'hand_counts'  => $handCounts ?? [],
            'deck_count'   => $deckCount ?? 0,
            'used_cards'   => $usedCards ?? [],
            'current_turn' => $turnPlayerId ?? null,
            'game_status'  => $game->game_status ?? null,
        ]);
    }



    public function updateDeckState(CardGame $game, array $deck, array $usedCards): void
    {
        $game->update([
            'deck'       => array_values($deck),
            'used_cards' => array_values($usedCards),
        ]);
    }


    public function playCard(Request $request, int $roomId){
        $request->validate([
            'card' => ['required', 'string', 'regex:/^(?:[2-9]|10|[JQKA])-[\x{2660}\x{2665}\x{2666}\x{2663}]$/u'],
        ]);

        $userId = $request->user()->id;
        $card   = (string) $request->input('card');

        [$game, $actingHand, $usedCards, $handCounts, $deckCount, $turnPlayerId, $gameStatus] =
            DB::transaction(function () use ($roomId, $userId, $card) {
                $room = Room::with(['game', 'players'])->lockForUpdate()->findOrFail($roomId);
                $game = $room->game;

                if (!$game) {
                    abort(422, 'Game not initialized.');
                }

                if ($userId !== $game->current_turn) {
                    abort(422, 'Not your turn.');
                }

                $hands = $game->player_hands ?? [];
                $hand  = $hands[(string)$userId] ?? [];

                if (!in_array($card, $hand, true)) {
                    abort(422, 'You do not have that card in your hand.');
                }

                $usedCards = $game->used_cards ?? [];
                $topCard   = !empty($usedCards) ? $usedCards[array_key_last($usedCards)] : null;

                if ($topCard && !$this->isValidPlay($card, $topCard)) {
                    abort(422, 'Invalid play - card does not match suit or value.');
                }

                // Izņem kārti no rokas
                $idx = array_search($card, $hand, true);
                unset($hand[$idx]);
                $hands[(string)$userId] = array_values($hand);

                // Pievieno kārti pie izmantotajām
                $usedCards[] = $card;
                $usedCards = array_values($usedCards);

                // Aprēķina nākamo gājienu
                $players = $room->players()
                    ->orderBy('room_user.created_at', 'asc')
                    ->pluck('users.id')
                    ->toArray();

                $currentIndex = array_search($game->current_turn, $players, true);
                $nextIndex = ($currentIndex !== false && count($players) > 0)
                    ? (($currentIndex + 1) % count($players))
                    : 0;

                $nextTurn = $players[$nextIndex] ?? $game->current_turn;

                // Atjauno spēles stāvokli
                $game->player_hands = $hands;
                $game->used_cards   = $usedCards;
                $game->game_status  = (count($hand) === 0) ? 'finished' : 'in_progress';
                $game->current_turn = $game->game_status === 'finished' ? null : $nextTurn;
                $game->save();

                $handCounts = collect($hands)->map(fn($h) => count($h))->toArray();
                $deckCount = count($game->deck);

                return [
                    $game,
                    $hand,
                    $usedCards,
                    $handCounts,
                    $deckCount,
                    $game->current_turn,
                    $game->game_status,
                ];
            });

        broadcast(new CardPlayed(
            roomId:       $game->room_id,
            userId:       $userId,
            card:         $card,
            usedCards:    $usedCards,
            handCounts:   $handCounts,
            turnPlayerId: $turnPlayerId,
            deckCount:    $deckCount
        ));

        broadcast(new HandSynced(
            userId: $userId,
            hand:   $actingHand
        ));

        return response()->json([
            'success'      => true,
            'hand'         => $actingHand ?? null,
            'hand_counts'  => $handCounts ?? [],
            'deck_count'   => $deckCount ?? 0,
            'used_cards'   => $usedCards ?? [],
            'current_turn' => $turnPlayerId ?? null,
            'game_status'  => $game->game_status ?? null,
        ]);
    }

    protected function isValidPlay(string $card, string $topCard): bool
    {
        // Correctly parse "VALUE-SUIT" format (e.g., "10-♣")
        [$cValue, $cSuit]   = $this->splitCard($card);
        [$tValue, $tSuit]   = $this->splitCard($topCard);

        return $cSuit === $tSuit || $cValue === $tValue;
    }

    protected function splitCard(string $code): array
    {
        // robust split: limit 2 parts, tolerate bad input
        $parts = explode('-', $code, 2);
        $value = $parts[0] ?? '';
        $suit  = $parts[1] ?? '';
        return [$value, $suit];
    }

    public function pickUpCard(Request $request, int $roomId)
    {
        $userId = $request->user()->id;

        [$game, $userHand, $handCounts, $deckCount, $turnPlayerId] =
            DB::transaction(function () use ($roomId, $userId) {
                $room = Room::with(['game', 'players'])->lockForUpdate()->findOrFail($roomId);
                $game = $room->game;

                if (!$game) {
                    abort(422, 'Game not initialized.');
                }

                if ($userId !== $game->current_turn) {
                    abort(422, 'Not your turn.');
                }

                $hands = $game->player_hands ?? [];
                $deck  = $game->deck ?? [];

                if (empty($deck)) {
                    abort(422, 'No more cards in deck.');
                }

                $drawn = array_shift($deck);
                $hands[(string)$userId][] = $drawn;

                $game->player_hands = $hands;
                $this->updateDeckState($game, $deck, $game->used_cards ?? []);
                $game->save();

                $handCounts = collect($hands)->map(fn($h) => count($h))->toArray();
                $deckCount  = count($deck);

                return [$game, $hands[(string)$userId], $handCounts, $deckCount, $game->current_turn];
            });

        broadcast(new HandSynced(
            userId: $userId,
            hand:   $userHand
        ));

        broadcast(new CardPlayed(
            roomId:       $game->room_id,
            userId:       $userId,
            card:         '', // empty since it's a pickup
            usedCards:    $game->used_cards ?? [],
            handCounts:   $handCounts,
            turnPlayerId: $turnPlayerId,
            deckCount:    $deckCount
        ))->toOthers();

        return response()->json([
            'success'      => true,
            'hand'         => $actingHand ?? null,
            'hand_counts'  => $handCounts ?? [],
            'deck_count'   => $deckCount ?? 0,
            'used_cards'   => $usedCards ?? [],
            'current_turn' => $turnPlayerId ?? null,
            'game_status'  => $game->game_status ?? null,
        ]);
    }

    public function resyncState(Request $request, int $roomId)
    {
        $userId = $request->user()->id;

        $room = Room::with(['players', 'game'])->findOrFail($roomId);
        $game = $room->game;

        // Pārbaude: vai lietotājs ir istabā
        if (!$room->players()->where('users.id', $userId)->exists()) {
            abort(403, 'You must join this room first.');
        }

        if (!$game) {
            abort(422, 'Game not initialized.');
        }

        $hands = $game->player_hands ?? [];
        $usedCards = $game->used_cards ?? [];
        $handCounts = collect($hands)->map(fn($h) => count($h))->toArray();

        return response()->json([
            'hand'         => $hands[(string)$userId] ?? [],
            'hand_counts'  => $handCounts,
            'deck_count'   => count($game->deck ?? []),
            'used_cards'   => $usedCards,
            'current_turn' => $game->current_turn,
            'game_status'  => $game->game_status,
        ]);
    }



}
