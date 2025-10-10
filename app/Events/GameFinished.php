<?php

namespace App\Events;

namespace App\Events;

use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;

class GameFinished implements ShouldBroadcast
{
    public function __construct(
        public int $roomId,
        public int $winnerId,
        public array $handCounts = []
    ) {}

    public function broadcastOn(): PresenceChannel {
        return new PresenceChannel("room-{$this->roomId}");
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
