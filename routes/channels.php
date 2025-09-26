<?php

use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('user.{userId}', function ($user, int $userId) {
    // Private user channel: allow only the owner
    return (int) $user->id === (int) $userId;
});

Broadcast::channel('room-{roomId}', function ($user, int $roomId) {
    // Presence room channel: user must be a member of the room
    if (! $user->rooms()->whereKey($roomId)->exists()) {
        return false;
    }

    // Presence channels must return user info to share presence roster
    return [
        'id'   => (int) $user->id,
        'name' => (string) ($user->name ?? "Player {$user->id}"),
    ];
});

