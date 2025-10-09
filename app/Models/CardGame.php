<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CardGame extends Model
{
    protected $fillable = [
        'room_id', 'game_status', 'player_hands', 'game_started_at','deck', 'used_cards', 'current_turn',
    ];

    protected $casts = [
        'deck' => 'array',
        'player_hands' => 'array',
        'used_cards' => 'array',
        'game_started_at' => 'datetime',
    ];

    public function room(){
        return $this->belongsTo(Room::class);
    }

    public function canStartGame(){
        return $this->game && $this->game->game_status === 'waiting' && $this->players()->count() >= 2;
    }

    public function currentPlayer(){
        return $this->belongsTo(User::class, 'current_turn');
    }

    public function isActive(){
        return in_array($this->game_status, ['starting', 'in_progress']);
    }

    public function isWaiting() {
        return $this->game_status === 'waiting';
    }

    public function isFinished() {
        return $this->game_status === 'finished';
    }
}
