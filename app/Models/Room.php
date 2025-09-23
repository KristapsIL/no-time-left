<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Room extends Model
{
    protected $fillable = [
        'room_name','room_code', 'max_players', 'public', 'rules', 'created_by',
        'game_status', 'player_hands', 'cards_per_player', 'game_started_at',
        'deck', 'used_cards',
    ];

    protected $casts = [
        'rules' => 'array',
        'deck' => 'array',
        'player_hands' => 'array',
        'used_cards' => 'array',
        'game_started_at' => 'datetime',
    ];

    public function owner()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
    public function player()
    {
        return $this->belongsToMany(User::class, 'room_user');
    }
    
    public function players()
    {
        return $this->belongsToMany(User::class)
                ->withPivot('role')
                ->withTimestamps();
    }
    
    public function canStartGame()
    {
        return $this->game_status === 'waiting' && $this->players()->count() >= 2;
    }
    
    public function isGameActive()
    {
        return in_array($this->game_status, ['starting', 'in_progress']);
    }

}
