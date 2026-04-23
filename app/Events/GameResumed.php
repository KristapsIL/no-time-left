<?php

namespace App\Events;

use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Broadcasting\InteractsWithSockets;

class GameResumed implements ShouldBroadcastNow
{
    use InteractsWithSockets;

    public function __construct(
        public int $roomId,
        public array $handCounts,
        public int $deckCount,
        public array $usedCards,
        public ?int $currentTurn,
        public array $players,
    ) {}

    public function broadcastOn(): PresenceChannel
    {
        return new PresenceChannel("room-{$this->roomId}");
    }

    public function broadcastAs(): string
    {
        return 'game-resumed';
    }

    public function broadcastWith(): array
    {
        return [
            'hand_counts'   => $this->handCounts,
            'deck_count'    => $this->deckCount,
            'used_cards'    => $this->usedCards,
            'current_turn'  => $this->currentTurn,
            'players'       => $this->players,
        ];
    }
}
