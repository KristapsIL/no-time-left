<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;
use App\Models\Room;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

// Events (make sure these exist with the sanitized payloads we discussed)
use App\Events\GameStarted;
use App\Events\CardPlayed;
use App\Events\HandSynced; // private per-user hand sync
// use App\Events\CardPickedUp; // (optional) if you add a separate event

class CardGameController extends Controller
{
    public function board(Request $request, int $roomId): Response|RedirectResponse
    {
        $inRoom = $request->user()
            ->rooms()
            ->where('rooms.id', $roomId)
            ->exists();

        if (!$inRoom) {
            return redirect()
                ->route('findRoom')
                ->with('error', 'Join the room before opening the board.');
        }

        $room = Room::with(['players']) // preload players for UI seating if needed
            ->findOrFail($roomId);

        if ((!$room->deck || empty($room->deck)) && $room->game_status === 'waiting') {
            $room->deck = $this->buildDeck();
            $room->save();
        }

        return Inertia::render('cardgame/Board', [
            'room'   => $room,
            'rules'  => $room->rules,
            'deck'   => $room->deck ?? [],
            'userId' => $request->user()->id,
        ]);
    }

    public function shuffle(int $roomId): RedirectResponse
    {
        $room = Room::findOrFail($roomId);
        $deck = $room->deck ?? [];

        shuffle($deck);

        $room->deck = $deck;
        $room->save();

        return back();
    }

    public function reset(int $roomId): RedirectResponse
    {
        $room = Room::findOrFail($roomId);
        $room->deck = $this->buildDeck();
        $room->save();

        return back();
    }

    private function buildDeck(): array
    {
        // Deck format: "VALUE-SUIT_SYMBOL", e.g., "10-♣", "Q-♥"
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

    public function startGame(Request $request, int $roomId)
    {
        $userId = $request->user()->id;

        [$room, $hands, $deck, $usedCards, $players] = DB::transaction(function () use ($roomId, $userId) {
            $room = Room::whereKey($roomId)->lockForUpdate()->firstOrFail();

            $isMember = $room->players()->whereKey($userId)->exists();
            if (!$isMember) abort(403, 'You must join this room before starting the game.');
            if ($room->game_status === 'in_progress') abort(409, 'Game already started');

            $players = $room->players()
                ->orderBy('room_user.created_at', 'asc')
                ->get();

            if ($players->count() < 2) abort(422, 'Need at least 2 players to start');

            $deck = $room->deck ?: $this->buildDeck();
            shuffle($deck);

            $cardsPerPlayer = $room->cards_per_player ?? 6;
            if ($players->count() * $cardsPerPlayer > count($deck)) {
                abort(422, 'Not enough cards for all players');
            }

            $hands = [];
            foreach ($players as $player) {
                $dealt = array_splice($deck, 0, $cardsPerPlayer);
                $hands[(string) $player->id] = array_values($dealt);
            }

            $firstCard = array_shift($deck);
            $usedCards = [$firstCard];

            $room->fill([
                'player_hands'    => $hands,
                'game_status'     => 'in_progress',
                'current_turn'    => $players[0]->id,
                'game_started_at' => now(),
            ])->save();

            $this->updateDeckState($room, $deck, $usedCards);

            return [$room, $hands, $deck, $usedCards, $players];
        });

        // Build counts & deck size for sanitized broadcast
        $handCounts = [];
        foreach ($hands as $pid => $h) $handCounts[$pid] = count($h);
        $deckCount = count($deck);

        try {
            // presence — to all room members (sanitized)
            broadcast(new GameStarted(
                roomId:        $room->id,
                handCounts:    $handCounts,
                usedCards:     $usedCards,
                turnPlayerId:  $room->current_turn,
                deckCount:     $deckCount
            ));
        } catch (\Exception $e) {
            Log::error('Failed to broadcast game started: ' . $e->getMessage());
        }

        // private — send exact hand to each player
        foreach ($players as $p) {
            try {
                broadcast(new HandSynced(
                    userId: $p->id,
                    hand:   $hands[(string)$p->id]
                ));
            } catch (\Exception $e) {
                Log::error("Failed to sync hand to user {$p->id}: " . $e->getMessage());
            }
        }

        return response()->noContent();
    }

    public function updateDeckState(Room $room, array $deck, array $usedCards): void
    {
        $room->update([
            'deck'       => array_values($deck),
            'used_cards' => array_values($usedCards),
        ]);
    }

    public function playCard(Request $request, int $roomId)
    {
        $request->validate(['card' => ['required', 'string']]);
        $userId = $request->user()->id;
        $card   = (string) $request->input('card');

        // Do the mutation atomically
        [$room, $actingHand, $usedCards, $handCounts, $deckCount, $turnPlayerId] =
            DB::transaction(function () use ($roomId, $userId, $card) {
                $room = Room::whereKey($roomId)->lockForUpdate()->firstOrFail();

                if ($userId !== $room->current_turn) {
                    abort(422, 'Not your turn');
                }

                $hands = $room->player_hands ?? [];
                $hand  = $hands[(string)$userId] ?? [];

                if (!in_array($card, $hand, true)) {
                    abort(422, 'You do not have that card in your hand');
                }

                $usedCards = $room->used_cards ?? [];
                $topCard   = !empty($usedCards) ? $usedCards[array_key_last($usedCards)] : null;

                if ($topCard && !$this->isValidPlay($card, $topCard)) {
                    abort(422, 'Invalid play - card does not match suit or value');
                }

                // Remove exactly one occurrence
                $idx = array_search($card, $hand, true);
                if ($idx === false) {
                    abort(422, 'Card not found in your hand');
                }
                unset($hand[$idx]);
                $hand = array_values($hand);
                $hands[(string)$userId] = $hand;

                // Push to used/discard
                $usedCards[] = $card;

                // Advance turn in original seating order
                $players = $room->players()
                    ->orderBy('room_user.created_at', 'asc')
                    ->pluck('users.id')
                    ->toArray();

                $currentIndex = array_search($room->current_turn, $players, true);
                $nextIndex    = ($currentIndex + 1) % count($players);
                $room->current_turn = $players[$nextIndex];

                // Persist
                $room->player_hands = $hands;
                $room->used_cards   = $usedCards;
                $room->save();

                // Derived data for broadcast
                $handCounts = [];
                foreach ($hands as $pid => $h) $handCounts[$pid] = count($h);
                $deckCount  = count($room->deck);

                return [$room, $hand, $usedCards, $handCounts, $deckCount, $room->current_turn];
            });

        // Broadcasts outside the transaction to release lock sooner
        try {
            // presence — sanitized for all
            broadcast(new CardPlayed(
                roomId:        $room->id,
                userId:        $userId,
                card:          $card,
                usedCards:     $usedCards,
                handCounts:    $handCounts,
                turnPlayerId:  $turnPlayerId,
                deckCount:     $deckCount
            ))->toOthers(); // excludes the initiator if X-Socket-Id header was sent
        } catch (\Exception $e) {
            Log::error('Failed to broadcast card played event: ' . $e->getMessage());
        }

        try {
            // private — exact hand to the acting user (keeps client in sync even if optimistic)
            broadcast(new HandSynced(
                userId: $userId,
                hand:   $actingHand
            ));
        } catch (\Exception $e) {
            Log::error("Failed to hand-sync user {$userId}: " . $e->getMessage());
        }

        return response()->noContent();
    }

    protected function isValidPlay(string $card, string $topCard): bool
    {
        // Correctly parse "VALUE-SUIT" format (e.g., "10-♣")
        [$cValue, $cSuit]   = $this->splitCard($card);
        [$tValue, $tSuit]   = $this->splitCard($topCard);

        return $cSuit === $tSuit || $cValue === $tValue;
    }

    /** @return array{0:string,1:string} [value, suit] */
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

        [$room, $userHand, $handCounts, $deckCount, $turnPlayerId] =
            DB::transaction(function () use ($roomId, $userId) {
                $room = Room::whereKey($roomId)->lockForUpdate()->firstOrFail();

                if ($userId !== $room->current_turn) {
                    abort(422, 'Not your turn');
                }

                $hands = $room->player_hands ?? [];
                $deck  = $room->deck ?? [];

                if (empty($deck)) {
                    abort(422, 'No more cards in deck');
                }

                // Draw one card
                $drawn = array_shift($deck);
                $hands[(string)$userId][] = $drawn;

                // Persist
                $room->player_hands = $hands;
                $this->updateDeckState($room, $deck, $room->used_cards ?? []);
                $room->save();

                // NOTE: decide your rule: does pickup end the turn?
                // If yes, rotate here similar to playCard and set $room->current_turn accordingly.
                // For now, we keep the same current_turn (as in your original code).

                $handCounts = [];
                foreach ($hands as $pid => $h) $handCounts[$pid] = count($h);
                $deckCount  = count($deck);

                return [$room, $hands[(string)$userId], $handCounts, $deckCount, $room->current_turn];
            });

        // Optional: broadcast a "CardPickedUp" sanitized event to presence
        // try {
        //     broadcast(new CardPickedUp(
        //         roomId:        $room->id,
        //         userId:        $userId,
        //         handCounts:    $handCounts,
        //         deckCount:     $deckCount,
        //         turnPlayerId:  $turnPlayerId,
        //     ))->toOthers();
        // } catch (\Exception $e) {
        //     Log::error('Failed to broadcast pickup: ' . $e->getMessage());
        // }

        // Always sync the drawer’s private hand
        try {
            broadcast(new HandSynced(
                userId: $userId,
                hand:   $userHand
            ));
        } catch (\Exception $e) {
            Log::error("Failed to hand-sync user {$userId} after pickup: " . $e->getMessage());
        }

        return response()->noContent();
    }
}
