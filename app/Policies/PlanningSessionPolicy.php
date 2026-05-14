<?php

namespace App\Policies;

use App\Models\PlanningSession;
use App\Models\User;

class PlanningSessionPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, PlanningSession $planningSession): bool
    {
        return $user->isMemberOf($planningSession->team);
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function update(User $user, PlanningSession $planningSession): bool
    {
        return $planningSession->canBeFacilitatedBy($user);
    }

    public function delete(User $user, PlanningSession $planningSession): bool
    {
        return $planningSession->canBeFacilitatedBy($user);
    }

    public function restore(User $user, PlanningSession $planningSession): bool
    {
        return false;
    }

    public function forceDelete(User $user, PlanningSession $planningSession): bool
    {
        return false;
    }

    public function facilitate(User $user, PlanningSession $planningSession): bool
    {
        return $planningSession->canBeFacilitatedBy($user);
    }

    public function complete(User $user, PlanningSession $planningSession): bool
    {
        return $planningSession->canBeFacilitatedBy($user);
    }
}
