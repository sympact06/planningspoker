<?php

namespace App\Http\Controllers;

use App\Enums\VotingRoundStatus;
use App\Events\SessionUpdated;
use App\Http\Requests\StoreVoteRequest;
use App\Models\PlanningSession;
use App\Models\Vote;
use Illuminate\Http\RedirectResponse;

class VoteController extends Controller
{
    public function store(StoreVoteRequest $request, PlanningSession $planningSession): RedirectResponse
    {
        $votingRound = $planningSession->currentVotingRound;

        abort_unless($votingRound !== null, 422, 'Er is nog geen stemronde actief.');
        abort_unless($votingRound->status === VotingRoundStatus::Voting, 422, 'Deze stemronde staat niet open.');

        Vote::updateOrCreate(
            [
                'voting_round_id' => $votingRound->id,
                'user_id' => $request->user()->id,
            ],
            [
                'value' => $request->validated('value'),
            ],
        );

        SessionUpdated::dispatch($planningSession->id);

        return back();
    }
}
