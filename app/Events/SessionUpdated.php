<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Event;
use Throwable;

class SessionUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public int $planningSessionId) {}

    /**
     * Dispatch the event but never let a broadcast failure (e.g. Reverb down)
     * bubble up and break the user-facing HTTP request. Realtime is best-effort.
     */
    public static function dispatch(...$arguments): mixed
    {
        try {
            return Event::dispatch(new self(...$arguments));
        } catch (Throwable $e) {
            report($e);

            return null;
        }
    }

    /**
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
