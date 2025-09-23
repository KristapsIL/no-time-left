<?php

namespace App\Events;

use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Queue\SerializesModels;
use Illuminate\Broadcasting\InteractsWithSockets;

class GameStarted implements ShouldBroadcastNow
{
    use InteractsWithSockets, SerializesModels;

    public function __construct(
        public int $roomId,
        private array $handCounts,     // [userId => count]
        private array $usedCards,      // discard pile (or just top)
        private int $turnPlayerId,
        private int $deckCount
    ) {}

    public function broadcastOn()
    {
        return new PresenceChannel('room-' . $this->roomId);
    }

    public function broadcastAs(): string
    {
        return 'game-started';
    }

    public function broadcastWith(): array
    {
        return [
            'hand_counts'     => $this->handCounts,
            'used_cards'      => array_values($this->usedCards),
            'turn_player_id'  => $this->turnPlayerId,
            'deck_count'      => $this->deckCount,
        ];
    }
}
