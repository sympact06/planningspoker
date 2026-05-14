<?php

namespace App\Models;

use App\Enums\StoryStatus;
use Database\Factories\StoryFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'planning_session_id',
    'key',
    'title',
    'position',
    'status',
    'final_estimate',
])]
class Story extends Model
{
    /** @use HasFactory<StoryFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => StoryStatus::class,
        ];
    }

    public function planningSession(): BelongsTo
    {
        return $this->belongsTo(PlanningSession::class);
    }

    public function votingRounds(): HasMany
    {
        return $this->hasMany(VotingRound::class);
    }
}
