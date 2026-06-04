<?php

namespace App\Models;

use Database\Factories\RoomParticipantFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'room_id',
    'name',
    'color',
    'is_host',
    'last_seen_at',
])]
class RoomParticipant extends Model
{
    /** @use HasFactory<RoomParticipantFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_host' => 'boolean',
            'last_seen_at' => 'datetime',
        ];
    }

    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    public function votes(): HasMany
    {
        return $this->hasMany(RoomVote::class);
    }
}
