<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Room extends Model
{
    protected $fillable = [
        'room_name','room_code', 'created_by',
    ];

    public function owner() {
        return $this->belongsTo(User::class, 'created_by');
    }
    
    public function players(){
        return $this->belongsToMany(User::class)
                ->withPivot('role')
                ->withTimestamps();
    }

    public function game() {
        return $this->hasOne(CardGame::class);
    }

    public function rules(){
        return $this->hasOne(RoomRules::class);
    }
    

    public function canStartGame(){
        return $this->game && $this->game->game_status === 'waiting' && $this->players()->count() >= 2;
    }

    public function isGameActive(){
        return $this->game && in_array($this->game->game_status, ['starting', 'in_progress']);
    }


}
