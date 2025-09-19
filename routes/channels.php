<?php

use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

// Allow all authenticated users to listen to my-channel
Broadcast::channel('my-channel', function ($user) {
    return true; // or add your own authorization logic here
});

// Allow authenticated users to listen to room-specific channels (presence channel)
Broadcast::channel('room-{roomId}', function ($user, $roomId) {
    // Check if user is a member of the room and return user data for presence
    $room = \App\Models\Room::find($roomId);
    if (!$room) return false;
    
    $isMember = $room->players()->where('user_id', $user->id)->exists();
    if (!$isMember) return false;
    
    // Return user data for presence channel
    return [
        'id' => $user->id,
        'name' => $user->name,
        'email' => $user->email
    ];
});

