<?php

namespace App\Support;

use App\Models\Room;
use App\Models\RoomParticipant;
use Illuminate\Contracts\Session\Session;

/**
 * Resolves and remembers the anonymous participant identity for a room. The
 * participant id is stored in the (cookie-backed) session, keyed per room, so a
 * guest is recognised across requests and on the broadcasting auth endpoint
 * without needing an account.
 */
final class CurrentRoomParticipant
{
    public static function sessionKey(Room $room): string
    {
        return 'room_participant.'.$room->id;
    }

    public static function for(Room $room, Session $session): ?RoomParticipant
    {
        $participantId = $session->get(self::sessionKey($room));

        if ($participantId === null) {
            return null;
        }

        return RoomParticipant::query()
            ->where('room_id', $room->id)
            ->whereKey($participantId)
            ->first();
    }

    public static function remember(Room $room, RoomParticipant $participant, Session $session): void
    {
        $session->put(self::sessionKey($room), $participant->id);
    }
}
