<?php

namespace Database\Factories;

use App\Enums\VoteValue;
use App\Models\User;
use App\Models\Vote;
use App\Models\VotingRound;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Vote>
 */
class VoteFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'voting_round_id' => VotingRound::factory(),
            'user_id' => User::factory(),
            'value' => fake()->randomElement(VoteValue::values()),
        ];
    }
}
