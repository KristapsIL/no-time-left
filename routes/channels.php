<?php

use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

// Allow all authenticated users to listen to my-channel
Broadcast::channel('my-channel', function ($user) {
    return true; // or add your own authorization logic here
});

// Allow authenticated users to listen to room-specific channels
Broadcast::channel('room-{roomId}', function ($user, $roomId) {
    // You can add more sophisticated authorization here
    // For example, check if user is a member of the room
    return \App\Models\Room::where('id', $roomId)->exists();
});
