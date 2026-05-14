<?php

namespace App\Models;

use Database\Factories\VoteFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['voting_round_id', 'user_id', 'value'])]
class Vote extends Model
{
    /** @use HasFactory<VoteFactory> */
    use HasFactory;

    public function votingRound(): BelongsTo
    {
        return $this->belongsTo(VotingRound::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
