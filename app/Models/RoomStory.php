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
    'gitlab_project_id',
    'gitlab_issue_iid',
    'gitlab_web_url',
    'title',
    'position',
    'status',
    'final_estimate',
    'gitlab_synced_at',
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
            'gitlab_synced_at' => 'datetime',
        ];
    }

    /**
     * Whether this story is linked to a GitLab issue whose weight we can sync.
     */
    public function isLinkedToGitLab(): bool
    {
        return $this->gitlab_project_id !== null && $this->gitlab_issue_iid !== null;
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
