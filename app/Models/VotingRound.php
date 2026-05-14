<?php

namespace App\Models;

use App\Enums\VotingRoundStatus;
use Database\Factories\VotingRoundFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'planning_session_id',
    'story_id',
    'started_by_id',
    'status',
    'revealed_at',
    'accepted_at',
])]
class VotingRound extends Model
{
    /** @use HasFactory<VotingRoundFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => VotingRoundStatus::class,
            'revealed_at' => 'datetime',
            'accepted_at' => 'datetime',
        ];
    }

    public function planningSession(): BelongsTo
    {
        return $this->belongsTo(PlanningSession::class);
    }

    public function story(): BelongsTo
    {
        return $this->belongsTo(Story::class);
    }

    public function startedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'started_by_id');
    }

    public function votes(): HasMany
    {
        return $this->hasMany(Vote::class);
    }

    public function showsVotes(): bool
    {
        return in_array($this->status, [
            VotingRoundStatus::Revealed,
            VotingRoundStatus::Accepted,
        ], true);
    }

    public function suggestedEstimate(): ?string
    {
        $votes = $this->relationLoaded('votes')
            ? $this->votes
            : $this->votes()->get();

        /** @var Collection<int, Vote> $votes */
        $numericVotes = $votes
            ->pluck('value')
            ->filter(fn (string $value): bool => is_numeric($value))
            ->map(fn (string $value): int => (int) $value)
            ->sort()
            ->values();

        if ($numericVotes->isEmpty()) {
            return null;
        }

        return (string) $numericVotes->get((int) floor(($numericVotes->count() - 1) / 2));
    }
}
