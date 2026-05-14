<?php

namespace Database\Factories;

use App\Enums\PlanningSessionStatus;
use App\Models\PlanningSession;
use App\Models\Team;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PlanningSession>
 */
class PlanningSessionFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'team_id' => Team::factory(),
            'facilitator_id' => User::factory(),
            'name' => 'Refinement '.fake()->numberBetween(1, 99),
            'status' => PlanningSessionStatus::Active,
            'current_story_id' => null,
            'current_voting_round_id' => null,
            'completed_at' => null,
        ];
    }
}
