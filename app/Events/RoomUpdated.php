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

class RoomUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public string $code) {}

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
            new PresenceChannel('room.'.$this->code),
        ];
    }

    public function broadcastAs(): string
    {
        return 'room.updated';
    }

    /**
     * @return array{code: string}
     */
    public function broadcastWith(): array
    {
        return [
            'code' => $this->code,
        ];
    }
}
