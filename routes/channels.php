<?php

use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

// Allow all authenticated users to listen to my-channel
Broadcast::channel('my-channel', function ($user) {
    return true; // or add your own authorization logic here
});

Broadcast::channel('room-{roomId}', function ($user, $roomId) {
    $room = \App\Models\Room::find($roomId);
    if (!$room) return false;

    $isMember = $room->players()->where('user_id', $user->id)->exists();
    if (!$isMember) return false;

    return [
        'id'   => (int) $user->id,
        'name' => (string) $user->name,
    ];
});

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});



