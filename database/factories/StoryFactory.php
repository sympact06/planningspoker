<?php

namespace Database\Factories;

use App\Enums\StoryStatus;
use App\Models\PlanningSession;
use App\Models\Story;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Story>
 */
class StoryFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'planning_session_id' => PlanningSession::factory(),
            'key' => 'POK-'.fake()->unique()->numberBetween(100, 999),
            'title' => fake()->sentence(5),
            'position' => fake()->numberBetween(0, 20),
            'status' => StoryStatus::Pending,
            'final_estimate' => null,
        ];
    }
}
