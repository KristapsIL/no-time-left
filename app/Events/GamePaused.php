<?php

namespace App\Events;

use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Broadcasting\InteractsWithSockets;

class GamePaused implements ShouldBroadcastNow
{
    use InteractsWithSockets;

    public function __construct(
        public int $roomId,
        public string $leaverName,
    ) {}

    public function broadcastOn(): PresenceChannel
    {
        return new PresenceChannel("room-{$this->roomId}");
    }

    public function broadcastAs(): string
    {
        return 'game-paused';
    }

    public function broadcastWith(): array
    {
        return ['leaver_name' => $this->leaverName];
    }
}
