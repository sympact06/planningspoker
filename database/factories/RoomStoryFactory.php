<?php

namespace Database\Factories;

use App\Enums\StoryStatus;
use App\Models\Room;
use App\Models\RoomStory;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<RoomStory>
 */
class RoomStoryFactory extends Factory
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
            'key' => 'POK-'.fake()->unique()->numberBetween(100, 999),
            'title' => ucfirst(fake()->words(4, true)),
            'position' => 0,
            'status' => StoryStatus::Pending,
            'final_estimate' => null,
        ];
    }

    public function estimated(string $estimate = '5'): static
    {
        return $this->state(fn (): array => [
            'status' => StoryStatus::Estimated,
            'final_estimate' => $estimate,
        ]);
    }
}
