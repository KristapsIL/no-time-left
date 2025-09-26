<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RoomRules extends Model
{
    protected $fillable = [
        'max_players', 'public', 'rules', 'cards_per_player', 'room_id'
    ];
    protected $casts = [
        'rules' => 'array',
    ];
    public function room() {
        return $this->belongsTo(Room::class);
    }
}
