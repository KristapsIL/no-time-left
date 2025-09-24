<?php

namespace App\Events;

use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Queue\SerializesModels;
use Illuminate\Broadcasting\InteractsWithSockets;

class GameStarted implements ShouldBroadcastNow
{
    use InteractsWithSockets, SerializesModels;

    public int $roomId;
    public array $handCounts;
    public array $usedCards;
    public int $turnPlayerId;
    public int $deckCount;

    public function __construct(
        int $roomId,
        array $handCounts,
        array $usedCards,
        int $turnPlayerId,
        int $deckCount
    ) {
        $this->roomId = $roomId;
        $this->handCounts = $handCounts;
        $this->usedCards = $usedCards;
        $this->turnPlayerId = $turnPlayerId;
        $this->deckCount = $deckCount;
    }

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
            'hand_counts'    => $this->handCounts,
            'used_cards'     => $this->usedCards,
            'turn_player_id' => $this->turnPlayerId,
            'deck_count'     => $this->deckCount,
        ];
    }
}

