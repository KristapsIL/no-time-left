<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;
use App\Models\Room;

class CardGameController extends Controller
{
    public function board(Request $request, $roomId): Response{
        $room = Room::findOrFail($roomId);

        if (!$room->deck || empty($room->deck)) {
            $room->deck = $this->buildDeck();
            $room->save();
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
}
