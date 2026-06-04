<?php

namespace Database\Factories;

use App\Enums\VotingRoundStatus;
use App\Models\Room;
use App\Models\RoomRound;
use App\Models\RoomStory;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<RoomRound>
 */
class RoomRoundFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'room_id' => Room::factory(),
            'room_story_id' => RoomStory::factory(),
            'status' => VotingRoundStatus::Voting,
        ];
    }

    public function revealed(): static
    {
        return $this->state(fn (): array => [
            'status' => VotingRoundStatus::Revealed,
            'revealed_at' => now(),
        ]);
    }
}
