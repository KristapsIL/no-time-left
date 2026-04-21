<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RoomRules extends Model
{
    protected $fillable = [
        'max_players',
        'public',
        'rules',
        'cards_per_player',
        'turn_timeout_seconds',
        'bot_fill_count',
        'bot_difficulty',
        'room_id',
    ];
    protected $casts = [
        'rules' => 'array',
        'turn_timeout_seconds' => 'integer',
        'bot_fill_count' => 'integer',
    ];

    public function room()
    {
        return $this->belongsTo(Room::class);
    }

}
