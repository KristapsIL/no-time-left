<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use App\Models\Room;

class GameStarted implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $roomId;
    public $player_hands;
    public $deck;
    public $used_cards;

    public function __construct($roomId, $player_hands, $deck, $used_cards = [])
    {
        $this->roomId = $roomId;
        $this->player_hands = $player_hands;
        $this->deck = $deck;
        $this->used_cards = $used_cards;
    }

    public function broadcastOn()
    {
        return new PresenceChannel('room-' . $this->roomId);
    }

    public function broadcastAs()
    {
        return 'game-started';
    }
}

