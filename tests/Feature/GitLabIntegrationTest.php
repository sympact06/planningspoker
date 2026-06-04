<?php

use App\Events\RoomUpdated;
use App\Jobs\SyncStoryWeightToGitLab;
use App\Models\Room;
use App\Models\RoomGitlabConnection;
use App\Models\RoomParticipant;
use App\Models\RoomRound;
use App\Models\RoomStory;
use App\Support\CurrentRoomParticipant;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Laravel\Socialite\Contracts\Provider;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as SocialiteUser;

beforeEach(function () {
    Event::fake([RoomUpdated::class]);
});

it('imports selected GitLab issues as stories for the host', function () {
    $room = Room::factory()->create();
    RoomGitlabConnection::factory()->for($room)->create();
    $host = RoomParticipant::factory()->for($room)->host()->create();

    joinAs($room, $host);

    $this->post(route('rooms.gitlab.import', $room), [
        'issues' => [
            ['project_id' => 7, 'iid' => 42, 'title' => 'Login flow', 'web_url' => 'https://gitlab.com/g/p/-/issues/42', 'reference' => 'g/p#42'],
            ['project_id' => 7, 'iid' => 43, 'title' => 'Dashboard audit', 'web_url' => 'https://gitlab.com/g/p/-/issues/43', 'reference' => 'g/p#43'],
        ],
    ])->assertRedirect();

    expect($room->stories()->count())->toBe(2);

    $story = $room->stories()->where('gitlab_issue_iid', 42)->firstOrFail();
    expect($story->gitlab_project_id)->toBe(7);
    expect($story->key)->toBe('g/p#42');
    expect($room->fresh()->current_story_id)->toBe($story->id);
});

it('skips GitLab issues already linked in the room', function () {
    $room = Room::factory()->create();
    RoomGitlabConnection::factory()->for($room)->create();
    $host = RoomParticipant::factory()->for($room)->host()->create();
    RoomStory::factory()->for($room)->create([
        'gitlab_project_id' => 7,
        'gitlab_issue_iid' => 42,
    ]);

    joinAs($room, $host);

    $this->post(route('rooms.gitlab.import', $room), [
        'issues' => [
            ['project_id' => 7, 'iid' => 42, 'title' => 'Duplicate', 'reference' => 'g/p#42'],
        ],
    ])->assertRedirect();

    expect($room->stories()->where('gitlab_issue_iid', 42)->count())->toBe(1);
});

it('forbids non-hosts from importing GitLab issues', function () {
    $room = Room::factory()->create();
    $guest = RoomParticipant::factory()->for($room)->create();

    joinAs($room, $guest);

    $this->post(route('rooms.gitlab.import', $room), [
        'issues' => [['project_id' => 7, 'iid' => 42, 'title' => 'Nope']],
    ])->assertForbidden();
});

it('lists GitLab issues for the host through the stored connection', function () {
    Http::fake([
        '*/api/v4/projects/7/issues*' => Http::response([
            ['iid' => 42, 'title' => 'Login flow', 'web_url' => 'https://gitlab.com/g/p/-/issues/42', 'weight' => 3, 'references' => ['full' => 'g/p#42']],
        ]),
    ]);

    $room = Room::factory()->create();
    RoomGitlabConnection::factory()->for($room)->create();
    $host = RoomParticipant::factory()->for($room)->host()->create();

    joinAs($room, $host);

    $this->getJson(route('rooms.gitlab.issues', [$room, 'project_id' => 7]))
        ->assertOk()
        ->assertJsonPath('issues.0.iid', 42)
        ->assertJsonPath('issues.0.weight', 3)
        ->assertJsonPath('issues.0.reference', 'g/p#42');
});

it('returns 409 when browsing GitLab without a connection', function () {
    $room = Room::factory()->create();
    $host = RoomParticipant::factory()->for($room)->host()->create();

    joinAs($room, $host);

    $this->getJson(route('rooms.gitlab.issues', [$room, 'project_id' => 7]))
        ->assertStatus(409);
});

it('dispatches a weight sync when a linked story is accepted with a numeric estimate', function () {
    Bus::fake([SyncStoryWeightToGitLab::class]);

    $room = Room::factory()->create();
    RoomGitlabConnection::factory()->for($room)->create();
    $story = RoomStory::factory()->for($room)->create([
        'gitlab_project_id' => 7,
        'gitlab_issue_iid' => 42,
    ]);
    $round = RoomRound::factory()->for($room)->revealed()->create(['room_story_id' => $story->id]);
    $room->update(['current_story_id' => $story->id, 'current_round_id' => $round->id]);
    $host = RoomParticipant::factory()->for($room)->host()->create();
    $round->votes()->create(['room_participant_id' => $host->id, 'value' => '8']);

    joinAs($room, $host);

    $this->post(route('rooms.rounds.accept', [$room, $round]), ['estimate' => '8'])
        ->assertRedirect();

    Bus::assertDispatched(SyncStoryWeightToGitLab::class);
});

it('does not sync non-numeric estimates', function () {
    Bus::fake([SyncStoryWeightToGitLab::class]);

    $room = Room::factory()->create();
    RoomGitlabConnection::factory()->for($room)->create();
    $story = RoomStory::factory()->for($room)->create([
        'gitlab_project_id' => 7,
        'gitlab_issue_iid' => 42,
    ]);
    $round = RoomRound::factory()->for($room)->revealed()->create(['room_story_id' => $story->id]);
    $room->update(['current_story_id' => $story->id, 'current_round_id' => $round->id]);
    $host = RoomParticipant::factory()->for($room)->host()->create();
    $round->votes()->create(['room_participant_id' => $host->id, 'value' => 'coffee']);

    joinAs($room, $host);

    $this->post(route('rooms.rounds.accept', [$room, $round]), ['estimate' => 'coffee'])
        ->assertRedirect();

    Bus::assertNotDispatched(SyncStoryWeightToGitLab::class);
});

it('does not sync when the room has no GitLab connection', function () {
    Bus::fake([SyncStoryWeightToGitLab::class]);

    $room = Room::factory()->create();
    $story = RoomStory::factory()->for($room)->create([
        'gitlab_project_id' => 7,
        'gitlab_issue_iid' => 42,
    ]);
    $round = RoomRound::factory()->for($room)->revealed()->create(['room_story_id' => $story->id]);
    $room->update(['current_story_id' => $story->id, 'current_round_id' => $round->id]);
    $host = RoomParticipant::factory()->for($room)->host()->create();
    $round->votes()->create(['room_participant_id' => $host->id, 'value' => '8']);

    joinAs($room, $host);

    $this->post(route('rooms.rounds.accept', [$room, $round]), ['estimate' => '8'])
        ->assertRedirect();

    Bus::assertNotDispatched(SyncStoryWeightToGitLab::class);
});

it('pushes the estimate to GitLab as the issue weight when the job runs', function () {
    Http::fake([
        '*/api/v4/projects/7/issues/42' => Http::response(['iid' => 42, 'weight' => 8]),
    ]);

    $room = Room::factory()->create();
    RoomGitlabConnection::factory()->for($room)->create();
    $story = RoomStory::factory()->for($room)->estimated('8')->create([
        'gitlab_project_id' => 7,
        'gitlab_issue_iid' => 42,
    ]);

    (new SyncStoryWeightToGitLab($story))->handle();

    Http::assertSent(fn ($request) => $request->method() === 'PUT'
        && str_contains($request->url(), '/projects/7/issues/42')
        && $request['weight'] === 8);

    expect($story->fresh()->gitlab_synced_at)->not->toBeNull();
});

it('lets the host bulk-sync every estimated linked story', function () {
    Bus::fake([SyncStoryWeightToGitLab::class]);

    $room = Room::factory()->create();
    RoomGitlabConnection::factory()->for($room)->create();
    RoomStory::factory()->for($room)->estimated('5')->create(['gitlab_project_id' => 7, 'gitlab_issue_iid' => 42]);
    RoomStory::factory()->for($room)->estimated('13')->create(['gitlab_project_id' => 7, 'gitlab_issue_iid' => 43]);
    RoomStory::factory()->for($room)->create(['gitlab_project_id' => 7, 'gitlab_issue_iid' => 44]); // pending, skipped
    $host = RoomParticipant::factory()->for($room)->host()->create();

    joinAs($room, $host);

    $this->post(route('rooms.gitlab.sync', $room))->assertRedirect();

    Bus::assertDispatchedTimes(SyncStoryWeightToGitLab::class, 2);
});

it('stores the host GitLab connection on OAuth callback', function () {
    $room = Room::factory()->create();
    $host = RoomParticipant::factory()->for($room)->host()->create();

    $socialiteUser = (new SocialiteUser)->map([
        'id' => 99,
        'nickname' => 'olivier',
        'name' => 'Olivier',
    ]);
    $socialiteUser->token = 'access-xyz';
    $socialiteUser->refreshToken = 'refresh-xyz';
    $socialiteUser->expiresIn = 7200;

    $provider = Mockery::mock(Provider::class);
    $provider->shouldReceive('user')->andReturn($socialiteUser);
    Socialite::shouldReceive('driver')->with('gitlab')->andReturn($provider);

    $this->withSession([
        'gitlab.connect_room' => $room->code,
        CurrentRoomParticipant::sessionKey($room) => $host->id,
    ])->get(route('gitlab.callback'))
        ->assertRedirect(route('rooms.show', $room));

    $connection = $room->fresh()->gitlabConnection;
    expect($connection)->not->toBeNull();
    expect($connection->gitlab_username)->toBe('olivier');
    expect($connection->access_token)->toBe('access-xyz');

    // Token is encrypted at rest, not stored in plain text.
    expect($connection->getRawOriginal('access_token'))->not->toBe('access-xyz');
});

it('forbids non-hosts from connecting GitLab', function () {
    $room = Room::factory()->create();
    $guest = RoomParticipant::factory()->for($room)->create();

    joinAs($room, $guest);

    $this->get(route('rooms.gitlab.connect', $room))->assertForbidden();
});
