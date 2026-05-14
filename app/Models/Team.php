<?php

namespace App\Models;

use App\Enums\TeamRole;
use Database\Factories\TeamFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name'])]
class Team extends Model
{
    /** @use HasFactory<TeamFactory> */
    use HasFactory;

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class)
            ->withPivot('role')
            ->withTimestamps();
    }

    public function planningSessions(): HasMany
    {
        return $this->hasMany(PlanningSession::class);
    }

    public function hasMember(User $user): bool
    {
        return $this->users()
            ->whereKey($user->getKey())
            ->exists();
    }

    public function isOwner(User $user): bool
    {
        return $this->users()
            ->whereKey($user->getKey())
            ->wherePivot('role', TeamRole::Owner->value)
            ->exists();
    }
}
