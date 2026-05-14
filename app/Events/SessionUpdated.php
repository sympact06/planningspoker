<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class SessionUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public int $planningSessionId) {}

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new PresenceChannel('planning-session.'.$this->planningSessionId),
        ];
    }

    public function broadcastAs(): string
    {
        return 'session.updated';
    }

    /**
     * @return array{planningSessionId: int}
     */
    public function broadcastWith(): array
    {
        return [
            'planningSessionId' => $this->planningSessionId,
        ];
    }
}
