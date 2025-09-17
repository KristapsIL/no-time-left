<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MyEvent implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $message;
    public $user;
    public $timestamp;
    public $roomId;

    public function __construct($message, $user = null, $roomId = null)
    {
        $this->message = $message;
        $this->user = $user;
        $this->timestamp = now()->toISOString();
        $this->roomId = $roomId;
    }

    public function broadcastOn()
    {
        if ($this->roomId) {
            return ['room-' . $this->roomId];
        }
        return ['my-channel'];
    }

    public function broadcastAs()
    {
        return 'my-event';
    }
}
