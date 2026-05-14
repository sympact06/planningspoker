<?php

namespace App\Policies;

use App\Models\Team;
use App\Models\User;

class TeamPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Team $team): bool
    {
        return $team->hasMember($user);
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function update(User $user, Team $team): bool
    {
        return $team->isOwner($user);
    }

    public function delete(User $user, Team $team): bool
    {
        return $team->isOwner($user);
    }

    public function restore(User $user, Team $team): bool
    {
        return false;
    }

    public function forceDelete(User $user, Team $team): bool
    {
        return false;
    }

    public function manageMembers(User $user, Team $team): bool
    {
        return $team->isOwner($user);
    }
}
