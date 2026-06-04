<?php

use App\Models\PlanningSession;
use App\Models\Room;
use App\Models\User;
use App\Support\CurrentRoomParticipant;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function (?User $user, $id) {
    return $user instanceof User && (int) $user->id === (int) $id;
});

Broadcast::channel('planning-session.{planningSessionId}', function (?User $user, int $planningSessionId) {
    if (! $user instanceof User) {
        return false;
    }

    $planningSession = PlanningSession::query()->find($planningSessionId);

    if (! $planningSession instanceof PlanningSession || ! $user->can('view', $planningSession)) {
        return false;
    }

    return [
        'id' => $user->id,
        'name' => $user->name,
    ];
});

/*
 * Anonymous room presence. The broadcasting auth endpoint runs on the "web"
 * middleware (no "auth"), so a guest's participant identity is read from the
 * session rather than from an authenticated User.
 */
Broadcast::channel('room.{code}', function (?User $user, string $code) {
    $room = Room::query()->where('code', $code)->first();

    if (! $room instanceof Room) {
        return false;
    }

    $participant = CurrentRoomParticipant::for($room, request()->session());

    if ($participant === null) {
        return false;
    }

    return [
        'id' => $participant->id,
        'name' => $participant->name,
        'color' => $participant->color,
        'is_host' => $participant->is_host,
    ];
});
