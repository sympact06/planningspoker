<?php

namespace App\Http\Requests\Concerns;

use App\Models\Room;
use App\Models\RoomParticipant;
use App\Support\CurrentRoomParticipant;

trait AuthorizesRoomParticipant
{
    protected function room(): ?Room
    {
        $room = $this->route('room');

        return $room instanceof Room ? $room : null;
    }

    protected function participant(): ?RoomParticipant
    {
        $room = $this->room();

        if (! $room instanceof Room) {
            return null;
        }

        return CurrentRoomParticipant::for($room, $this->session());
    }

    protected function participantIsHost(): bool
    {
        return (bool) $this->participant()?->is_host;
    }
}
