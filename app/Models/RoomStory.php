<?php

namespace App\Models;

use App\Enums\StoryStatus;
use Database\Factories\RoomStoryFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'room_id',
    'key',
    'title',
    'position',
    'status',
    'final_estimate',
])]
class RoomStory extends Model
{
    /** @use HasFactory<RoomStoryFactory> */
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

    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    public function rounds(): HasMany
    {
        return $this->hasMany(RoomRound::class);
    }
}
