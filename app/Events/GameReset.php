<?php

// app/Events/GameReset.php
namespace App\Events;

use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;

class GameReset implements ShouldBroadcast
{
    public function __construct(public int $roomId) {}

    public function broadcastOn(): PresenceChannel
    {
        return new PresenceChannel("room-{$this->roomId}");
    }

    public function broadcastAs(): string
    {
        return 'game-reset';
    }

    public function broadcastWith(): array
    {
        return [];
    }
}
}