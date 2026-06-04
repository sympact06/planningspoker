<?php

namespace App\Models;

use App\Enums\VotingRoundStatus;
use Database\Factories\RoomRoundFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'room_id',
    'room_story_id',
    'status',
    'revealed_at',
    'accepted_at',
])]
class RoomRound extends Model
{
    /** @use HasFactory<RoomRoundFactory> */
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

    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    public function story(): BelongsTo
    {
        return $this->belongsTo(RoomStory::class, 'room_story_id');
    }

    public function votes(): HasMany
    {
        return $this->hasMany(RoomVote::class);
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

        /** @var Collection<int, RoomVote> $votes */
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
