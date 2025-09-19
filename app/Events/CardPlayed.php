<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Queue\SerializesModels;

class CardPlayed implements ShouldBroadcastNow
{
    use InteractsWithSockets, SerializesModels;

    public int $roomId;
    public int $userId;
    public string $card;
    public array $playerHands;
    public array $usedCards;

    public function __construct(int $roomId, int $userId, string $card, array $playerHands, array $usedCards)
    {
        $this->roomId = $roomId;
        $this->userId = $userId;
        $this->card = $card;
        $this->playerHands = $playerHands;
        $this->usedCards = $usedCards;
    }

    public function broadcastOn(): Channel
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
            'user_id' => $this->userId,
            'card' => $this->card,
            'player_hands' => $this->playerHands,
            'used_cards' => $this->usedCards,
        ];
    }
}
