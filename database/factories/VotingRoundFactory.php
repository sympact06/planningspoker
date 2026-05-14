<?php

namespace Database\Factories;

use App\Enums\VotingRoundStatus;
use App\Models\PlanningSession;
use App\Models\Story;
use App\Models\User;
use App\Models\VotingRound;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<VotingRound>
 */
class VotingRoundFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $planningSession = PlanningSession::factory();

        return [
            'planning_session_id' => $planningSession,
            'story_id' => Story::factory()->for($planningSession),
            'started_by_id' => User::factory(),
            'status' => VotingRoundStatus::Voting,
            'revealed_at' => null,
            'accepted_at' => null,
        ];
    }
}
