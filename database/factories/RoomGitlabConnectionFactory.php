<?php

namespace Database\Factories;

use App\Models\Room;
use App\Models\RoomGitlabConnection;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<RoomGitlabConnection>
 */
class RoomGitlabConnectionFactory extends Factory
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
            'gitlab_user_id' => fake()->numberBetween(1, 9999),
            'gitlab_username' => fake()->userName(),
            'access_token' => 'test-access-token',
            'refresh_token' => 'test-refresh-token',
            'token_expires_at' => now()->addHour(),
            'connected_by_participant_id' => null,
        ];
    }
}
