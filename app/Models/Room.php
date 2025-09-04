<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Room extends Model
{
    protected $fillable = ['room_code', 'max_players','public', 'rules','created_by' ];

    protected $casts = [
        'rules' => 'array',
    ];

    public function owner()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
    public function players(){
        $this->belongsToMany(User::class)
                ->withPivot('role')->withTimestamps();
    }

}
