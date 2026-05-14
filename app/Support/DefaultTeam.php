<?php

namespace App\Support;

use App\Enums\TeamRole;
use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class DefaultTeam
{
    public static function ensureFor(User $user): Team
    {
        $team = $user->teams()->oldest('teams.id')->first();

        if ($team instanceof Team) {
            return $team;
        }

        return self::createFor($user);
    }

    public static function createFor(User $user): Team
    {
        return DB::transaction(function () use ($user): Team {
            $team = Team::create([
                'name' => self::nameFor($user),
            ]);

            $team->users()->attach($user->getKey(), [
                'role' => TeamRole::Owner->value,
            ]);

            return $team;
        });
    }

    private static function nameFor(User $user): string
    {
        $firstName = trim((string) Str::of($user->name)->trim()->before(' '));

        return 'Team van '.($firstName !== '' ? $firstName : 'mij');
    }
}
