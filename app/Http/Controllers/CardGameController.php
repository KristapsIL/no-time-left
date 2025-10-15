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
use App\Events\GameFinished;
use App\Events\GameReset;
use Illuminate\Http\JsonResponse;

class CardGameController extends Controller
{
    public function board(Request $request, int $roomId)
    {
        $user = $request->user();

        $inRoom = $user->rooms()->where('rooms.id', $roomId)->exists();
        if (! $inRoom) {
            return redirect()
                ->route('findRoom')
                ->with('error', 'Join the room before opening the board.');
        }

        [$room, $game] = DB::transaction(function () use ($roomId) {
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


    public function reset(Request $request, int $roomId): \Illuminate\Http\JsonResponse
    {
        DB::transaction(function () use ($roomId) {
            $game = \App\Models\CardGame::where('room_id', $roomId)->lockForUpdate()->firstOrFail();

            $game->player_hands = [];
            $game->used_cards   = [];
            $game->deck         = [];      // let your start game build a fresh deck
            $game->current_turn = null;
            $game->winner    = null;
            $game->game_status  = 'waiting';
            $game->save();

            broadcast(new \App\Events\GameReset($roomId)); // to all
        });

        return response()->json(['ok' => true], 200);
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

    
    public function startGame(Request $request, int $roomId)
    {
        $userId = $request->user()->id;

        [$game, $hands, $deck, $usedCards, $players] = DB::transaction(function () use ($roomId, $userId) {
            $room = Room::with(['players', 'game', 'rules'])->lockForUpdate()->findOrFail($roomId);

            // Validations
            $this->validateStartConditions($room, $userId);

            $game = $room->game ?? new CardGame(['room_id' => $room->id]);
            $deck =  $this->buildDeck();
            shuffle($deck);

            $cardsPerPlayer = $room->rules->cards_per_player ?? 6;
            $players = $room->players()->orderBy('room_user.created_at')->get();

            $hands = $this->dealCards($deck, $players, $cardsPerPlayer);

            $firstCard  = array_shift($deck);
            $usedCards  = [$firstCard];

            // First player starts
            $firstTurnId = $players->first()->id;
            $this->initializeGame($game, $hands, $deck, $usedCards, $firstTurnId);

            return [$game, $hands, $deck, $usedCards, $players];
        });

        $handCounts = collect($hands)->map(fn($h) => count($h))->toArray();
        $deckCount  = count($deck);
        $turnId     = $game->current_turn;

        // Broadcast the start to everyone (shared fields)
        broadcast(new GameStarted(
            roomId:       $game->room_id,
            handCounts:   $handCounts,
            usedCards:    $usedCards,
            turnPlayerId: $turnId,
            deckCount:    $deckCount
        ));

        foreach ($players as $p) {
            $pid = (int) $p->id;
            broadcast(new HandSynced(
                roomId:       $game->room_id,
                userId:       $pid,
                hand:         $hands[(string)$pid] ?? [],
                handCounts:   $handCounts,
                deckCount:    $deckCount,
                usedCards:    $usedCards,
                turnPlayerId: $turnId,
            ));
        }

    return redirect()->back()->with('success', 'Game Started');
    }

    public function updateDeckState(CardGame $game, array $deck, array $usedCards): void
    {
        $game->update([
            'deck'       => array_values($deck),
            'used_cards' => array_values($usedCards),
        ]);
    }

    public function playCard(Request $request, int $roomId)
    {
        $request->validate([
            'card' => ['required', 'string', 'regex:/^(?:[2-9]|10|[JQKA])-[\x{2660}\x{2665}\x{2666}\x{2663}]$/u'],
        ]);

        $userId = (int) $request->user()->id;
        $card   = (string) $request->input('card');

        [
            $roomIdOut,
            $hand,
            $usedCards,
            $handCounts,
            $deckCount,
            $nextTurn,
            $finished,
            $winnerId
        ] = DB::transaction(function () use ($roomId, $userId, $card) {
            $room = Room::with(['game', 'players'])->lockForUpdate()->findOrFail($roomId);
            $game = $room->game;

            if (!$game || $userId !== (int) $game->current_turn) {
                abort(422, 'Not your turn or game not initialized.');
            }

            $hands = $game->player_hands ?? [];
            $playerKey = (string) $userId;
            $hand = $hands[$playerKey] ?? [];

            // Validate the player has the card (exactly one instance)
            $idx = array_search($card, $hand, true);
            if ($idx === false) {
                abort(422, 'Card not in hand');
            }

            // Validate play against current top card (if any)
            $usedArr = $game->used_cards ?? [];
            $topCard = !empty($usedArr) ? end($usedArr) : null;
            if ($topCard && !$this->isValidPlay($card, $topCard)) {
                abort(422, 'Invalid play');
            }

            // Remove exactly one instance of the card
            array_splice($hand, $idx, 1);
            $hands[$playerKey] = $hand;

            // Add to used pile (top will be this card)
            $usedArr[] = $card;

            // Determine if finished, and next turn if not finished
            $finished = count($hand) === 0;
            $winnerId = $finished ? $userId : null;

            $nextTurn = null;
            if (!$finished) {
                $playerIds = $room->players()
                    ->orderBy('room_user.created_at')
                    ->pluck('users.id')
                    ->toArray();

                $currentIndex = array_search($game->current_turn, $playerIds, true);
                $nextTurn = $playerIds[($currentIndex + 1) % max(count($playerIds), 1)] ?? null;
                $game->has_picked_up = false;
            }

            // Persist game state
            $game->player_hands = $hands;
            $game->used_cards   = array_values($usedArr);
            $game->current_turn = $finished ? null : $nextTurn;
            $game->game_status  = $finished ? 'finished' : 'in_progress';
            if ($finished) {
                $game->winner = $winnerId;
            }
            $game->save();

            $handCounts = collect($hands)->map(fn ($h) => count($h))->toArray();
            $deckCount  = count($game->deck ?? []);

            return [
                $game->room_id,
                $hand,
                $game->used_cards,
                $handCounts,
                $deckCount,
                $nextTurn,
                $finished,
                $winnerId,
            ];
        });

        broadcast(new \App\Events\HandSynced(
            roomId:       $roomIdOut,
            userId:       $userId,
            hand:         $hand,
            handCounts:   $handCounts,
            deckCount:    $deckCount,
            usedCards:    $usedCards,
            turnPlayerId: $finished ? null : $nextTurn,
        ));

        if ($finished) {
            // Notify others the game finished
            broadcast(new \App\Events\GameFinished(
                roomId: $roomIdOut,
                winnerId: $winnerId,
                handCounts: $handCounts
            ));

            return response()->json([
                'finished'  => true,
                'winner_id' => $winnerId,
            ], 200);
        }

        // Notify others about the shared changes
        broadcast(new \App\Events\CardPlayed(
            roomId: $roomIdOut,
            userId: $userId,
            card: $card,
            handCounts: $handCounts,
            deckCount: $deckCount,
            turnPlayerId: $nextTurn,
            usedCards: $usedCards
        ))->toOthers();

        return redirect()->back()->with('success', 'Card played!');

    }

    protected function isValidPlay(string $card, string $topCard): bool
    {
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
    private function checkDeckAndReshuffle(array &$deck, \App\Models\CardGame $game): void
    {
        $used = $game->used_cards ?? [];

        if (count($deck) === 0) {
            $top = null;
            if (!empty($used)) {
                $top = array_pop($used); // keep visible top
            }

            if (!empty($used)) {
                shuffle($used);
                $deck = array_values($used); // updates caller's $deck
            } else {
                $deck = [];
            }

            $game->used_cards = $top ? [$top] : [];
            $game->deck       = $deck;
            $game->save();
        }
    }

    public function pickUpCard(Request $request, int $roomId)
    {
        $userId = (int) $request->user()->id;

        [$game, $hand, $handCounts, $deckCount, $drawnCard] = DB::transaction(function () use ($roomId, $userId) {
            $room = Room::with(['game', 'players'])->lockForUpdate()->findOrFail($roomId);
            $game = $room->game;
            if (!$game || $game->has_picked_up == true) {
                abort(409, 'Cant pick up more');
            }

            if (!$game || $userId !== (int) $game->current_turn) {
                abort(422, 'Not your turn or game not initialized.');
            }

            $hands = $game->player_hands ?? [];
            $deck  = $game->deck ?? [];
            $this->checkDeckAndReshuffle($deck, $game);


            if (count($deck) === 0) {
                $handCounts = collect($hands)->map(fn ($h) => count($h))->toArray();
                return [$game, $hands[(string)$userId] ?? [], $handCounts, 0, null];
            }

            $rulesJson = RoomRules::where('room_id', $roomId)->value('rules');
            $matchRuleExists = in_array('pick_up_till_match', $rulesJson ?? []);

            $pickedup = 0;

            $usedCards = $game->used_cards ?? [];
            $topCard = !empty($usedCards)
                ? $usedCards[array_key_last($usedCards)]
                : null;

            do {
                $this->checkDeckAndReshuffle($deck, $game);

                if (count($deck) === 0) {
                    break;
                }
                $drawn = array_shift($deck);


                $playerKey   = (string) $userId;
                $playerHand  = $hands[$playerKey] ?? [];
                $playerHand[] = $drawn;
                $hands[$playerKey] = $playerHand;

                $game->player_hands = $hands;
                $game->deck = $deck;
                $game->save();

                $pickedup++;

            } while (!$this->isValidPlay($drawn, $topCard) && $matchRuleExists);
            $game->has_picked_up = true;
            $game->save();

            $handCounts = collect($hands)->map(fn ($h) => count($h))->toArray();

            return [$game, $playerHand, $handCounts, count($deck), $drawn];

        });

        broadcast(new \App\Events\HandSynced(
            roomId:       $game->room_id,
            userId:       $userId,
            hand:         $hand,
            handCounts:   $handCounts,
            deckCount:    $deckCount,
            usedCards:    $game->used_cards ?? [],
            turnPlayerId: $game->current_turn,
        ));

        // Notify others (counts + deck + top + turn); no full hand for privacy
        broadcast(new \App\Events\CardPlayed(
            roomId: $game->room_id,
            userId: $userId,
            card: '', // pickup (not a play); reusing event shape
            handCounts: $handCounts,
            deckCount: $deckCount,
            turnPlayerId: $game->current_turn,
            usedCards: $game->used_cards ?? []
        ))->toOthers();

        return response()->json([
            'hand'        => $hand,
            'hand_counts' => $handCounts,
            'deck_count'  => $deckCount,
            'used_cards'  => $game->used_cards ?? [],
            'drawn_card'  => $drawnCard, // null if no card drawn
        ], 200);
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
