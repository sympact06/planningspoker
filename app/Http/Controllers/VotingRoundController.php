<?php

namespace App\Http\Controllers;

use App\Enums\PlanningSessionStatus;
use App\Enums\StoryStatus;
use App\Enums\VotingRoundStatus;
use App\Events\SessionUpdated;
use App\Http\Requests\AcceptVotingRoundRequest;
use App\Http\Requests\StoreVotingRoundRequest;
use App\Models\PlanningSession;
use App\Models\VotingRound;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class VotingRoundController extends Controller
{
    public function store(StoreVotingRoundRequest $request, PlanningSession $planningSession): RedirectResponse
    {
        $validated = $request->validated();

        $votingRound = VotingRound::create([
            'planning_session_id' => $planningSession->id,
            'story_id' => $validated['story_id'],
            'started_by_id' => $request->user()->id,
            'status' => VotingRoundStatus::Voting,
        ]);

        $planningSession->update([
            'status' => PlanningSessionStatus::Active,
            'current_story_id' => $validated['story_id'],
            'current_voting_round_id' => $votingRound->id,
        ]);

        SessionUpdated::dispatch($planningSession->id);

        return back();
    }

    public function reveal(Request $request, PlanningSession $planningSession, VotingRound $votingRound): RedirectResponse
    {
        $this->authorize('facilitate', $planningSession);
        $this->ensureRoundBelongsToSession($planningSession, $votingRound);

        if ($votingRound->status === VotingRoundStatus::Voting || $votingRound->status === VotingRoundStatus::Intro) {
            $votingRound->update([
                'status' => VotingRoundStatus::Revealed,
                'revealed_at' => now(),
            ]);
        }

        SessionUpdated::dispatch($planningSession->id);

        return back();
    }

    public function accept(
        AcceptVotingRoundRequest $request,
        PlanningSession $planningSession,
        VotingRound $votingRound,
    ): RedirectResponse {
        $this->ensureRoundBelongsToSession($planningSession, $votingRound);

        abort_unless($votingRound->showsVotes(), 422, 'Stemmen moeten eerst zichtbaar zijn.');

        DB::transaction(function () use ($request, $planningSession, $votingRound): void {
            $votingRound->loadMissing('votes');

            $estimate = $request->validated('estimate') ?? $votingRound->suggestedEstimate();

            $votingRound->update([
                'status' => VotingRoundStatus::Accepted,
                'accepted_at' => now(),
            ]);

            $votingRound->story->update([
                'status' => StoryStatus::Estimated,
                'final_estimate' => $estimate,
            ]);

            $nextStory = $planningSession->stories()
                ->where('status', StoryStatus::Pending->value)
                ->orderBy('position')
                ->first();

            $planningSession->update([
                'current_story_id' => $nextStory?->id ?? $votingRound->story_id,
                'current_voting_round_id' => $nextStory === null ? $votingRound->id : null,
            ]);
        });

        SessionUpdated::dispatch($planningSession->id);

        return back();
    }

    public function revote(Request $request, PlanningSession $planningSession, VotingRound $votingRound): RedirectResponse
    {
        $this->authorize('facilitate', $planningSession);
        $this->ensureRoundBelongsToSession($planningSession, $votingRound);

        $newRound = VotingRound::create([
            'planning_session_id' => $planningSession->id,
            'story_id' => $votingRound->story_id,
            'started_by_id' => $request->user()->id,
            'status' => VotingRoundStatus::Voting,
        ]);

        $votingRound->story->update([
            'status' => StoryStatus::Pending,
            'final_estimate' => null,
        ]);

        $planningSession->update([
            'status' => PlanningSessionStatus::Active,
            'current_story_id' => $votingRound->story_id,
            'current_voting_round_id' => $newRound->id,
        ]);

        SessionUpdated::dispatch($planningSession->id);

        return back();
    }

    private function ensureRoundBelongsToSession(PlanningSession $planningSession, VotingRound $votingRound): void
    {
        abort_unless((int) $votingRound->planning_session_id === (int) $planningSession->id, 404);
    }
}
