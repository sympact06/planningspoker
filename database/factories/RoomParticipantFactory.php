<?php

namespace Database\Factories;

use App\Models\Room;
use App\Models\RoomParticipant;
use App\Support\RoomPalette;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<RoomParticipant>
 */
class RoomParticipantFactory extends Factory
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
            'name' => fake()->firstName(),
            'color' => fake()->randomElement(RoomPalette::COLORS),
            'is_host' => false,
            'last_seen_at' => now(),
        ];
    }

    public function host(): static
    {
        return $this->state(fn (): array => ['is_host' => true]);
    }
}
