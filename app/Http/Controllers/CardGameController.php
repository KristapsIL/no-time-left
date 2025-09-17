<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;
use App\Models\Room;
use Illuminate\Support\Facades\DB;


class CardGameController extends Controller
{
    public function board(Request $request, $roomId){
        $inRoom = $request->user()->rooms()->where('rooms.id', $roomId)->exists();
        if (!$inRoom) {
            return redirect()->route('findRoom')->with('error', 'Join the room before opening the board.');
        }

        $room = Room::findOrFail($roomId);

        if (!$room->deck || empty($room->deck)) {
            // Only build deck if game hasn't started
            if ($room->game_status === 'waiting') {
                $room->deck = $this->buildDeck();
                $room->save();
            }
        }

        return Inertia::render('cardgame/Board', [
            'room' => $room,
            'rules' => $room->rules,
            'deck' => $room->deck,
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
        $faces = ['2','3','4','5','6','7','8','9','10','jack','queen','king','ace'];
        $deck = [];

        foreach($suits as $suit){
            foreach($faces as $face){
                $deck[] = $face."".$suit;
            }
        }
        return $deck;
    }

    public function startGame(Request $request, int $roomId)
    {
        $userId = $request->user()->id;

        return DB::transaction(function () use ($roomId, $userId) {
            $room = Room::whereKey($roomId)->lockForUpdate()->firstOrFail();

            // Ensure caller is a member
            $isMember = $room->players()->whereKey($userId)->exists();
            if (!$isMember) {
                abort(403, 'You must join this room before starting the game.');
            }

            // Don’t start twice
            if ($room->game_status === 'in_progress') {
                return response()->json(['message' => 'Game already started'], 409);
            }

            // Get players in join order if pivot has timestamps; otherwise use a fallback order
            $playersQuery = $room->players();

            // If your pivot has timestamps:
            $playersQuery->orderBy('room_user.created_at', 'asc');

            // If not, comment the line above and use this fallback:
            // $playersQuery->orderBy('users.id', 'asc');

            $players = $playersQuery->get();

            // Count (fresh from DB)
            $playersCount = $players->count();
            if ($playersCount < 2) {
                return response()->json(['message' => 'Need at least 2 players to start'], 422);
            }

            // Build and deal the deck
            $deck = $room->deck ?: $this->buildDeck();
            shuffle($deck);

            $cardsPerPlayer = $room->cards_per_player ?? 6;

            if ($playersCount * $cardsPerPlayer > count($deck)) {
                return response()->json(['message' => 'Not enough cards for all players'], 422);
            }

            $hands = [];
            foreach ($players as $player) {
                $hands[(string) $player->id] = array_splice($deck, 0, $cardsPerPlayer);
            }

            $room->fill([
                'deck'            => array_values($deck),
                'player_hands'    => $hands,
                'game_status'     => 'in_progress',
                'game_started_at' => now(),
            ])->save();

            event(new \App\Events\GameStarted($room->id, $hands, $deck));

            return response()->noContent();
        });
    }


}
