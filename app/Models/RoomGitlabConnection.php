<?php

namespace App\Models;

use Database\Factories\RoomGitlabConnectionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * The host's GitLab OAuth credentials for a single room. Tokens are stored
 * encrypted; only the host of the room ever connects an account.
 */
#[Fillable([
    'room_id',
    'gitlab_user_id',
    'gitlab_username',
    'access_token',
    'refresh_token',
    'token_expires_at',
    'connected_by_participant_id',
])]
class RoomGitlabConnection extends Model
{
    /** @use HasFactory<RoomGitlabConnectionFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'access_token' => 'encrypted',
            'refresh_token' => 'encrypted',
            'token_expires_at' => 'datetime',
        ];
    }

    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    /**
     * Whether the access token has expired (or is about to within a minute).
     */
    public function isExpired(): bool
    {
        if ($this->token_expires_at === null) {
            return false;
        }

        return $this->token_expires_at->subMinute()->isPast();
    }
}
