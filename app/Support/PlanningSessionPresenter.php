<?php

namespace App\Support;

use App\Enums\StoryStatus;
use App\Enums\VoteValue;
use App\Models\PlanningSession;
use App\Models\User;
use App\Models\VotingRound;

final class PlanningSessionPresenter
{
    /**
     * @return array<string, mixed>
     */
    public function for(PlanningSession $planningSession, User $viewer): array
    {
        $planningSession->loadMissing([
            'team.users',
            'facilitator',
            'stories',
            'currentStory',
            'currentVotingRound.votes.user',
        ]);

        $currentRound = $planningSession->currentVotingRound;
        $showsVotes = $currentRound instanceof VotingRound && $currentRound->showsVotes();
        $votesByUser = $currentRound instanceof VotingRound
            ? $currentRound->votes->keyBy('user_id')
            : collect();

        $stories = $planningSession->stories
            ->sortBy('position')
            ->values();

        return [
            'id' => $planningSession->id,
            'name' => $planningSession->name,
            'status' => $planningSession->status->value,
            'team' => [
                'id' => $planningSession->team->id,
                'name' => $planningSession->team->name,
            ],
            'facilitator' => [
                'id' => $planningSession->facilitator?->id,
                'name' => $planningSession->facilitator?->name,
            ],
            'current_story_id' => $planningSession->current_story_id,
            'stories' => $stories->map(fn ($story): array => [
                'id' => $story->id,
                'key' => $story->key,
                'title' => $story->title,
                'position' => $story->position,
                'status' => $story->status->value,
                'final_estimate' => $story->final_estimate,
            ])->all(),
            'players' => $planningSession->team->users
                ->sortBy('name')
                ->values()
                ->map(fn (User $teamUser): array => [
                    'id' => $teamUser->id,
                    'name' => $teamUser->name,
                    'role' => $teamUser->pivot->role,
                    'is_facilitator' => (int) $planningSession->facilitator_id === (int) $teamUser->id,
                    'has_voted' => $votesByUser->has($teamUser->id),
                    'vote' => $showsVotes && $votesByUser->has($teamUser->id)
                        ? VoteValue::label($votesByUser->get($teamUser->id)->value)
                        : null,
                ])->all(),
            'current_round' => $currentRound instanceof VotingRound
                ? [
                    'id' => $currentRound->id,
                    'story_id' => $currentRound->story_id,
                    'status' => $currentRound->status->value,
                    'suggested_estimate' => $showsVotes ? $currentRound->suggestedEstimate() : null,
                    'distribution' => $showsVotes ? $this->distributionFor($currentRound) : [],
                    'votes' => $planningSession->team->users
                        ->sortBy('name')
                        ->values()
                        ->map(fn (User $teamUser): array => [
                            'user_id' => $teamUser->id,
                            'has_voted' => $votesByUser->has($teamUser->id),
                            'value' => $showsVotes && $votesByUser->has($teamUser->id)
                                ? $votesByUser->get($teamUser->id)->value
                                : null,
                            'label' => $showsVotes && $votesByUser->has($teamUser->id)
                                ? VoteValue::label($votesByUser->get($teamUser->id)->value)
                                : null,
                        ])->all(),
                ]
                : null,
            'stats' => [
                'total_stories' => $stories->count(),
                'estimated_stories' => $stories
                    ->where('status', StoryStatus::Estimated)
                    ->count(),
            ],
            'can' => [
                'facilitate' => $viewer->can('facilitate', $planningSession),
            ],
            'vote_values' => VoteValue::values(),
        ];
    }

    /**
     * @return array<string, int>
     */
    private function distributionFor(VotingRound $votingRound): array
    {
        return $votingRound->votes
            ->countBy('value')
            ->mapWithKeys(fn (int $count, string $value): array => [
                VoteValue::label($value) => $count,
            ])
            ->all();
    }
}
