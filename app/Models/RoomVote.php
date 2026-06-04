<?php

namespace App\Models;

use Database\Factories\RoomVoteFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'room_round_id',
    'room_participant_id',
    'value',
])]
class RoomVote extends Model
{
    /** @use HasFactory<RoomVoteFactory> */
    use HasFactory;

    public function round(): BelongsTo
    {
        return $this->belongsTo(RoomRound::class, 'room_round_id');
    }

    public function participant(): BelongsTo
    {
        return $this->belongsTo(RoomParticipant::class, 'room_participant_id');
    }
}
