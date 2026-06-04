<?php

namespace Database\Factories;

use App\Enums\RoomStatus;
use App\Models\Room;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Room>
 */
class RoomFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $name = fake()->words(3, true);

        return [
            'name' => ucfirst($name),
            'code' => Room::generateCode($name),
            'status' => RoomStatus::Active,
        ];
    }

    public function completed(): static
    {
        return $this->state(fn (): array => [
            'status' => RoomStatus::Completed,
            'completed_at' => now(),
        ]);
    }
}
