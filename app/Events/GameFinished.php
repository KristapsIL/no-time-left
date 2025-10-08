<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;

class GameFinished implements ShouldBroadcast
{
    public function __construct(
        public int $roomId,
        public int $winnerId,
        public array $handCounts = []
    ) {}

    public function broadcastOn(): Channel {
        return new Channel("room-{$this->roomId}");
    }

    public function broadcastAs(): string {
        return 'game-finished';
    }

    public function broadcastWith(): array {
        return [
            'winner_id'   => $this->winnerId,
            'hand_counts' => $this->handCounts,
        ];
    }
}