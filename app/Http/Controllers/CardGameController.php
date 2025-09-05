<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class CardGameController extends Controller
{
    public function board(): Response{
        $deck = session('deck');
        if(!$deck){
            $deck = $this->buildDeck();
        }
        return Inertia::render('cardgame/Board', [
            'deck' => $deck,
        ]);
    }
    public function shuffle(): RedirectResponse
    {
        $deck = session('deck') ?? $this->buildDeck();
        shuffle($deck);
        session(['deck' => $deck]);
        return back();
    }

    public function reset(): RedirectResponse
    {
        session()->forget('deck');
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
