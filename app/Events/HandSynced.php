<?php

namespace App\Events;

use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Queue\SerializesModels;
use Illuminate\Broadcasting\InteractsWithSockets;

class HandSynced implements ShouldBroadcastNow
{
    use InteractsWithSockets, SerializesModels;

    public function __construct(
        public int $roomId,
        public int $userId,
        public array $hand,
        public ?array $handCounts = null,
        public ?int $deckCount = null,
        public ?array $usedCards = null,
        public ?int $turnPlayerId = null,
    ) {}

    public function broadcastOn(): PresenceChannel
    {
        // MUST match your client: echo.join(`room-${roomId}`)
        return new PresenceChannel("room-{$this->roomId}");
    }

    public function broadcastAs(): string
    {
        return 'hand-synced'; // client listens .hand-synced
    }

    public function broadcastWith(): array
    {
        return [
            'userId'         => $this->userId,
            'hand'           => array_values($this->hand),
            'hand_counts'    => $this->handCounts,
            'deck_count'     => $this->deckCount,
            'used_cards'     => $this->usedCards,
            'turn_player_id' => $this->turnPlayerId,
        ];
    }
}