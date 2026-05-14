<?php

use App\Enums\TeamRole;
use App\Models\PlanningSession;
use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

test('planning session presence channel only authorizes team members', function () {
    config([
        'broadcasting.default' => 'reverb',
        'broadcasting.connections.reverb.key' => 'local-key',
        'broadcasting.connections.reverb.secret' => 'local-secret',
        'broadcasting.connections.reverb.app_id' => 'local-app',
    ]);
    Broadcast::forgetDrivers();
    require base_path('routes/channels.php');

    $owner = User::factory()->create([
        'name' => 'Ada Owner',
    ]);
    $outsider = User::factory()->create([
        'name' => 'Cara Outsider',
    ]);
    $team = Team::factory()->create();
    $team->users()->attach($owner->id, ['role' => TeamRole::Owner->value]);
    $planningSession = PlanningSession::factory()
        ->for($team)
        ->for($owner, 'facilitator')
        ->create();

    expect($owner->can('view', $planningSession))->toBeTrue();

    $response = $this->actingAs($owner)->postJson('/broadcasting/auth', [
        'socket_id' => '123.456',
        'channel_name' => 'presence-planning-session.'.$planningSession->id,
    ]);

    $response->assertOk();
    $channelData = json_decode($response->json('channel_data'), true);

    expect($channelData['user_info'])->toMatchArray([
        'id' => $owner->id,
        'name' => 'Ada Owner',
    ]);

    $this->actingAs($outsider)
        ->postJson('/broadcasting/auth', [
            'socket_id' => '123.456',
            'channel_name' => 'presence-planning-session.'.$planningSession->id,
        ])
        ->assertForbidden();
});
