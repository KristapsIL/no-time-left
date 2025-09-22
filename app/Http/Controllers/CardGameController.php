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

        [$room, $hands, $deck, $usedCards] = DB::transaction(function () use ($roomId, $userId) {
            $room = Room::whereKey($roomId)->lockForUpdate()->firstOrFail();

            $isMember = $room->players()->whereKey($userId)->exists();
            if (!$isMember) {
                abort(403, 'You must join this room before starting the game.');
            }

            if ($room->game_status === 'in_progress') {
                abort(409, 'Game already started');
            }

            $players = $room->players()
                ->orderBy('room_user.created_at', 'asc')
                ->get();

            if ($players->count() < 2) {
                abort(422, 'Need at least 2 players to start');
            }

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
                'player_hands' => $hands,
                'game_status' => 'in_progress',
                'current_turn' => $room->players[0]->id,
                'game_started_at' => now(),
            ])->save();

            $this->updateDeckState($room, $deck, $usedCards);
            
            return [$room, $hands, $deck, $usedCards];
        });

        try {
            broadcast(new GameStarted($room->id, $hands, $deck, $usedCards));
        } catch (\Exception $e) {
            Log::error('Failed to broadcast game started event: ' . $e->getMessage());
        }
    }


    public function updateDeckState(Room $room, array $deck, array $usedCards = []){
            $room->update([
                'deck' => array_values($deck),
                'used_cards' => array_values($usedCards),
            ]);
        }
        
    public function playCard(Request $request, int $roomId){
        $userId = $request->user()->id;
        $card = $request->input('card');

        $room = Room::findOrFail($roomId);

        if($userId === $room->current_turn){
            return response()->json(['error' => 'not your turn'], 422);
        }

        $hand = $room->player_hands[$userId] ?? [];

        if (!in_array($card, $hand)) {
            return response()->json(['error' => 'You do not have that card in your hand'], 422);
        }

        $usedCards = $room->used_cards ?? [];
        $topCard = !empty($usedCards) ? $usedCards[count($usedCards) - 1] : null;

        if ($topCard && !$this->isValidPlay($card, $topCard)) {
            return response()->json(['error' => 'Invalid play - card does not match suit or value'], 422);
        }

        $hands = $room->player_hands;
        $hands[$userId] = array_values(array_diff($hand, [$card]));
        $room->player_hands = $hands;

        $usedCards[] = $card;
        $room->used_cards = $usedCards;

        $players = $room->players->pluck('id')->toArray();
        $currentIndex = array_search($room->current_turn, $players);
        $nextIndex = ($currentIndex + 1) % count($players);
        $room->current_turn = $players[$nextIndex];
        
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

    protected function isValidPlay(string $card, string $topCard): bool{
        $cardValue = mb_substr($card, 0, -1);
        $cardSuit = mb_substr($card, -1);

        $topValue = mb_substr($topCard, 0, -1);
        $topSuit = mb_substr($topCard, -1);

        return $cardSuit === $topSuit || $cardValue === $topValue;
    }

    public function pickUpCard(Request $request, $roomId){
        $userId = $request->user()->id;
        $room = Room::findOrFail($roomId);

        $hands = $room->player_hands;
        $deck = $room->deck;

        $card = array_splice($deck, 0, 1);
        $hands[$userId][] = $card[0];

        $room->player_hands = $hands; 

        $this->updateDeckState($room, $deck);
        $room->save();
    }

}
