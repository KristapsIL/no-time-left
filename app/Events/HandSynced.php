<?php

namespace App\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Queue\SerializesModels;
use Illuminate\Broadcasting\InteractsWithSockets;

class HandSynced implements ShouldBroadcastNow
{
    use InteractsWithSockets, SerializesModels;

    public int $userId;
    public array $hand;

    public function __construct(int $userId, array $hand)
    {
        $this->userId = $userId;
        $this->hand = $hand;
    }

    public function broadcastOn()
    {
        return new PrivateChannel("user-{$this->userId}");
    }

    public function broadcastAs(): string
    {
        return 'hand-synced';
    }

    public function broadcastWith(): array
    {
        return ['hand' => array_values($this->hand)];
    }
}
