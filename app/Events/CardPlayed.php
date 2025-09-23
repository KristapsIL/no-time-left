<?php

namespace App\Events;

use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Queue\SerializesModels;
use Illuminate\Broadcasting\InteractsWithSockets;

class CardPlayed implements ShouldBroadcastNow
{
    use InteractsWithSockets, SerializesModels;

    public int $roomId;
    public int $userId;
    public string $card;
    public array $usedCards;
    public array $handCounts;   // NEW
    public int $turnPlayerId;   // NEW
    public int $deckCount;      // NEW

    public function __construct(
        int $roomId,
        int $userId,
        string $card,
        array $usedCards,
        array $handCounts,
        int $turnPlayerId,
        int $deckCount
    ) {
        $this->roomId = $roomId;
        $this->userId = $userId;
        $this->card = $card;
        $this->usedCards = $usedCards;
        $this->handCounts = $handCounts;
        $this->turnPlayerId = $turnPlayerId;
        $this->deckCount = $deckCount;
    }

    public function broadcastOn()
    {
        return new PresenceChannel('room-' . $this->roomId);
    }

    public function broadcastAs(): string
    {
        return 'card-played';
    }

    public function broadcastWith(): array
    {
        return [
            'player_id'     => $this->userId,
            'card'          => $this->card,
            'used_cards'    => $this->usedCards,
            'hand_counts'   => $this->handCounts,
            'turn_player_id'=> $this->turnPlayerId,
            'deck_count'    => $this->deckCount,
        ];
    }
}

