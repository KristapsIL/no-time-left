<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CardGame extends Model
{
    /** @use HasFactory<\Database\Factories\CardGameFactory> */
    use HasFactory;
    protected $fillable = [
        'room_id', 'game_status', 'player_hands', 'game_started_at','deck', 'used_cards', 'current_turn',
    ];

    protected $casts = [
        'deck' => 'array',
        'player_hands' => 'array',
        'used_cards' => 'array',
        'game_started_at' => 'datetime',
    ];
        public function rooms(){
        return $this->belongsToMany(Room::class);
    }
}
