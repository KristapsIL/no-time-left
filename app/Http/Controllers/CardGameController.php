<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;
use App\Models\Room;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

use App\Events\GameStarted;
use App\Events\CardPlayed;
use App\Events\HandSynced;

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

            $room->player_hands    = $hands;
            $room->game_status     = 'in_progress';
            $room->current_turn    = $players->first()->id;
            $room->game_started_at = now();
            $room->save();

            $this->updateDeckState($room, $deck, $usedCards);

            return [$room, $hands, $deck, $usedCards, $players];
        });

        $handCounts = [];
        foreach ($hands as $pid => $h) $handCounts[$pid] = count($h);
        $deckCount = count($deck);

        // Presence-safe broadcast
        broadcast(new GameStarted(
            roomId:       $room->id,
            handCounts:   $handCounts,
            usedCards:    $usedCards,
            turnPlayerId: $room->current_turn,
            deckCount:    $deckCount
        ));

        // Private hand sync
        foreach ($players as $p) {
            broadcast(new HandSynced(
                userId: $p->id,
                hand:   $hands[(string)$p->id]
            ));
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
        $request->validate([
            'card' => ['required', 'string', 'regex:/^(?:[2-9]|10|[JQKA])-[\x{2660}\x{2665}\x{2666}\x{2663}]$/u'],
        ]);

        $userId = $request->user()->id;
        $card   = (string) $request->input('card');

        [$roomIdOut, $actingHand, $usedCards, $handCounts, $deckCount, $turnPlayerId, $gameStatus] =
            DB::transaction(function () use ($roomId, $userId, $card) {

                $room = Room::whereKey($roomId)->lockForUpdate()->firstOrFail();

                if ($userId !== $room->current_turn) abort(422, 'Not your turn');

                $hands = $room->player_hands ?? [];
                $hand  = $hands[(string)$userId] ?? [];

                if (!in_array($card, $hand, true)) abort(422, 'You do not have that card in your hand');

                $usedCards = $room->used_cards ?? [];
                $topCard   = !empty($usedCards) ? $usedCards[array_key_last($usedCards)] : null;

                if ($topCard && !$this->isValidPlay($card, $topCard)) {
                    abort(422, 'Invalid play - card does not match suit or value');
                }

                $idx = array_search($card, $hand, true);
                unset($hand[$idx]);
                $hands[(string)$userId] = array_values($hand);

                $usedCards[] = $card;
                $usedCards   = array_values($usedCards);

                $players = $room->players()
                    ->orderBy('room_user.created_at', 'asc')
                    ->pluck('users.id')
                    ->toArray();

                $currentIndex = array_search($room->current_turn, $players, true);
                if ($currentIndex === false) $currentIndex = 0;
                $nextIndex  = (count($players) > 0) ? (($currentIndex + 1) % count($players)) : 0;
                $nextTurn   = $players[$nextIndex] ?? $room->current_turn;

                $room->player_hands = $hands;
                $room->used_cards   = $usedCards;
                $room->game_status  = (count($hand) === 0) ? 'finished' : 'in_progress';
                $room->current_turn = $room->game_status === 'finished' ? null : $nextTurn;

                $room->save();

                $handCounts = [];
                foreach ($hands as $pid => $h) $handCounts[$pid] = count($h);
                $deckCount = count($room->deck);

                return [
                    $room->id,
                    $hand,
                    $usedCards,
                    $handCounts,
                    $deckCount,
                    $room->current_turn,
                    $room->game_status,
                ];
            });

        broadcast(new CardPlayed(
            roomId:       $roomIdOut,
            userId:       $userId,
            card:         $card,
            usedCards:    $usedCards,
            handCounts:   $handCounts,
            turnPlayerId: $turnPlayerId,
            deckCount:    $deckCount
        ))->toOthers();

        broadcast(new HandSynced(
            userId: $userId,
            hand:   $actingHand
        ));

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

                if ($userId !== $room->current_turn) abort(422, 'Not your turn');

                $hands = $room->player_hands ?? [];
                $deck  = $room->deck ?? [];

                if (empty($deck)) abort(422, 'No more cards in deck');

                $drawn = array_shift($deck);
                $hands[(string)$userId][] = $drawn;

                $room->player_hands = $hands;
                $this->updateDeckState($room, $deck, $room->used_cards ?? []);
                $room->save();

                $handCounts = [];
                foreach ($hands as $pid => $h) $handCounts[$pid] = count($h);
                $deckCount  = count($deck);

                return [$room, $hands[(string)$userId], $handCounts, $deckCount, $room->current_turn];
            });

        broadcast(new HandSynced(
            userId: $userId,
            hand:   $userHand
        ));

        broadcast(new CardPlayed(
            roomId:       $room->id,
            userId:       $userId,
            card:         '',
            usedCards:    $room->used_cards ?? [],
            handCounts:   $handCounts,
            turnPlayerId: $turnPlayerId,
            deckCount:    $deckCount
        ))->toOthers();

        return back();
    }
    public function resyncState(Request $request, int $roomId)
    {
        $userId = $request->user()->id;

        $room = Room::with('players')->findOrFail($roomId);

        // Make sure user is in the room
        if (!$room->players()->where('users.id', $userId)->exists()) {
            abort(403, 'You must join this room first.');
        }

        $hands = $room->player_hands ?? [];
        $usedCards = $room->used_cards ?? [];
        $handCounts = [];

        foreach ($hands as $pid => $h) {
            $handCounts[$pid] = count($h);
        }

        return response()->json([
            'hand'           => $hands[(string)$userId] ?? [],
            'hand_counts'    => $handCounts,
            'deck_count'     => count($room->deck ?? []),
            'used_cards'     => $usedCards,
            'current_turn'   => $room->current_turn,
            'game_status'    => $room->game_status,
        ]);
    }


}
