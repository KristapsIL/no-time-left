<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;
use App\Models\Room;
use Illuminate\Support\Facades\DB;
use App\Events\CardPlayed;
use App\Events\GameStarted;
use Illuminate\Support\Facades\Log;

class CardGameController extends Controller
{
    public function board(Request $request, $roomId)
    {
        $inRoom = $request->user()->rooms()->where('rooms.id', $roomId)->exists();
        if (!$inRoom) {
            return redirect()->route('findRoom')->with('error', 'Join the room before opening the board.');
        }

        $room = Room::findOrFail($roomId);

        if (!$room->deck || empty($room->deck)) {
            if ($room->game_status === 'waiting') {
                $room->deck = $this->buildDeck();
                $room->save();
            }
        }

        return Inertia::render('cardgame/Board', [
            'room' => $room,
            'rules' => $room->rules,
            'deck' => $room->deck ?? [],
            'userId' => $request->user()->id,
        ]);
    }

    public function shuffle($roomId)
    {
        $room = Room::findOrFail($roomId);
        $deck = $room->deck;

        shuffle($deck);

        $room->deck = $deck;
        $room->save();

        return back();
    }

    public function reset($roomId)
    {
        $room = Room::findOrFail($roomId);
        $room->deck = $this->buildDeck();
        $room->save();

        return back();
    }

    private function buildDeck(){
        $suits = ["♠","♥","♦","♣"];
        $faces = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
        $deck = [];

        foreach($suits as $suit){
            foreach($faces as $face){
                $deck[] = $face."-".$suit;
            }
        }
        return $deck;
    }


    public function startGame(Request $request, int $roomId)
    {
        $userId = $request->user()->id;

        // 1) Do all DB work and compute the payload
        [$room, $hands, $deck, $usedCards] = DB::transaction(function () use ($roomId, $userId) {
            $room = Room::whereKey($roomId)->lockForUpdate()->firstOrFail();

            // Ensure caller is a member
            $isMember = $room->players()->whereKey($userId)->exists();
            if (!$isMember) {
                abort(403, 'You must join this room before starting the game.');
            }

            // Don’t start twice
            if ($room->game_status === 'in_progress') {
                abort(409, 'Game already started');
            }

            // Get players in join order
            $players = $room->players()
                ->orderBy('room_user.created_at', 'asc')
                ->get();

            if ($players->count() < 2) {
                abort(422, 'Need at least 2 players to start');
            }

            // Build and deal the deck
            $deck = $room->deck ?: $this->buildDeck();
            shuffle($deck);

            $cardsPerPlayer = $room->cards_per_player ?? 6;
            if ($players->count() * $cardsPerPlayer > count($deck)) {
                abort(422, 'Not enough cards for all players');
            }

            $hands = [];
            foreach ($players as $player) {
                $dealt = array_splice($deck, 0, $cardsPerPlayer);
                $hands[(string) $player->id] = $dealt;
            }

            $firstCard  = array_shift($deck);
            $usedCards  = [$firstCard];

            $room->fill([
                'player_hands'    => $hands,
                'game_status'     => 'in_progress',
                'game_started_at' => now(),
            ])->save();

            // Save deck + used cards to your storage
            $this->updateDeckState($room, $deck, $usedCards);

            // Return everything you need for broadcasting / response
            return [$room, $hands, $deck, $usedCards];
        });

        // 2) ✅ NOW broadcast to all users in the room
        try {
            broadcast(new GameStarted($room->id, $hands, $deck, $usedCards));
        } catch (\Exception $e) {
            // Log the error but don't fail the game start
            Log::error('Failed to broadcast game started event: ' . $e->getMessage());
        }

        // 3) ✅ Return something so Inertia's onSuccess fires (204 is fine if you do router.reload)
        return response()->noContent();
    }


        public function updateDeckState(Room $room, array $deck, array $usedCards = [])
        {
            $room->update([
                'deck' => array_values($deck),
                'used_cards' => array_values($usedCards),
            ]);
        }
        
        public function playCard(Request $request, int $roomId)
    {
        $userId = $request->user()->id;
        $card = $request->input('card');

        $room = Room::findOrFail($roomId);
        $hand = $room->player_hands[$userId] ?? [];

        if (!in_array($card, $hand)) {
            return response()->json(['error' => 'You do not have that card in your hand'], 422);
        }

        $usedCards = $room->used_cards ?? [];
        $topCard = !empty($usedCards) ? $usedCards[count($usedCards) - 1] : null;

        if ($topCard && !$this->isValidPlay($card, $topCard)) {
            return response()->json(['error' => 'Invalid play - card does not match suit or value'], 422);
        }

        // Update hand
        $hands = $room->player_hands;
        $hands[$userId] = array_values(array_diff($hand, [$card]));
        $room->player_hands = $hands;

        // Update used cards
        $usedCards[] = $card;
        $room->used_cards = $usedCards;

        $room->save();

        try {
            event(new CardPlayed(
                $room->id,
                $userId,
                $card,
                $room->player_hands,
                $room->used_cards
            ));
        } catch (\Exception $e) {
            Log::error('Failed to broadcast card played event: ' . $e->getMessage());
        }

        return response()->json(['success' => true]);
    }

    protected function isValidPlay(string $card, string $topCard): bool
    {
        // Example card format: "7♠", "Q♥", "A♦"
        $cardValue = mb_substr($card, 0, -1);
        $cardSuit = mb_substr($card, -1);

        $topValue = mb_substr($topCard, 0, -1);
        $topSuit = mb_substr($topCard, -1);

        // Valid if suit or value matches
        return $cardSuit === $topSuit || $cardValue === $topValue;
    }


}
