<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;

class GameReset implements ShouldBroadcast
{
    public function __construct(public int $roomId) {}

    public function broadcastOn(): Channel {
        return new Channel("room-{$this->roomId}");
    }

    public function broadcastAs(): string {
        return 'game-reset';
    }

    public function broadcastWith(): array {
        return [];
    }
}