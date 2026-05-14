<?php

use App\Models\PlanningSession;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

Broadcast::channel('planning-session.{planningSessionId}', function (User $user, int $planningSessionId) {
    $planningSession = PlanningSession::query()->find($planningSessionId);

    if (! $planningSession instanceof PlanningSession || ! $user->can('view', $planningSession)) {
        return false;
    }

    return [
        'id' => $user->id,
        'name' => $user->name,
    ];
});
