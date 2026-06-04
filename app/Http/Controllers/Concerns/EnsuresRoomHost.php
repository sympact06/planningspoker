<?php

namespace App\Http\Controllers\Concerns;

use App\Models\Room;
use App\Models\RoomParticipant;
use App\Support\CurrentRoomParticipant;
use Illuminate\Http\Request;

trait EnsuresRoomHost
{
    /**
     * Abort with 403 unless the current session participant is the room host.
     */
    protected function ensureHost(Request $request, Room $room): RoomParticipant
    {
        $participant = CurrentRoomParticipant::for($room, $request->session());

        abort_unless($participant instanceof RoomParticipant && $participant->is_host, 403);

        return $participant;
    }
}
