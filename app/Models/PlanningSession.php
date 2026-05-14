<?php

namespace App\Models;

use App\Enums\PlanningSessionStatus;
use Database\Factories\PlanningSessionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'team_id',
    'facilitator_id',
    'name',
    'status',
    'current_story_id',
    'current_voting_round_id',
    'completed_at',
])]
class PlanningSession extends Model
{
    /** @use HasFactory<PlanningSessionFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => PlanningSessionStatus::class,
            'completed_at' => 'datetime',
        ];
    }

    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    public function facilitator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'facilitator_id');
    }

    public function currentStory(): BelongsTo
    {
        return $this->belongsTo(Story::class, 'current_story_id');
    }

    public function currentVotingRound(): BelongsTo
    {
        return $this->belongsTo(VotingRound::class, 'current_voting_round_id');
    }

    public function stories(): HasMany
    {
        return $this->hasMany(Story::class)->orderBy('position');
    }

    public function votingRounds(): HasMany
    {
        return $this->hasMany(VotingRound::class)->latest();
    }

    public function isFacilitatedBy(User $user): bool
    {
        return (int) $this->facilitator_id === (int) $user->getKey();
    }

    public function canBeFacilitatedBy(User $user): bool
    {
        return $this->isFacilitatedBy($user)
            || $user->isOwnerOf($this->team);
    }
}
