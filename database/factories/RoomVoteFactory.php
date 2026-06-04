<?php

namespace Database\Factories;

use App\Enums\VoteValue;
use App\Models\RoomParticipant;
use App\Models\RoomRound;
use App\Models\RoomVote;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<RoomVote>
 */
class RoomVoteFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'room_round_id' => RoomRound::factory(),
            'room_participant_id' => RoomParticipant::factory(),
            'value' => fake()->randomElement(VoteValue::estimateValues()),
        ];
    }
}
