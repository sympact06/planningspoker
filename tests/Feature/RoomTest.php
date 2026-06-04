<?php

use App\Enums\RoomStatus;
use App\Enums\StoryStatus;
use App\Enums\VotingRoundStatus;
use App\Events\RoomUpdated;
use App\Models\Room;
use App\Models\RoomParticipant;
use App\Models\RoomRound;
use App\Models\RoomStory;
use App\Support\CurrentRoomParticipant;
use App\Support\RoomPresenter;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake([RoomUpdated::class]);
});

it('lets a guest create a room with stories and become host', function () {
    $response = $this->post(route('rooms.store'), [
        'name' => 'Sprint 42',
        'host_name' => 'Olivier',
        'stories' => [
            ['key' => 'POK-101', 'title' => 'Login flow'],
            ['title' => 'Dashboard audit'],
        ],
    ]);

    $room = Room::query()->firstOrFail();

    $response->assertRedirect(route('rooms.show', $room));
    $this->assertSame('Sprint 42', $room->name);
    $this->assertCount(2, $room->stories);
    $this->assertSame($room->stories->first()->id, $room->current_story_id);

    $host = $room->participants()->where('is_host', true)->firstOrFail();
    $this->assertSame('Olivier', $host->name);

    $this->assertSame($host->id, session(CurrentRoomParticipant::sessionKey($room)));
    Event::assertDispatched(RoomUpdated::class);
});

it('lets a guest create an empty room to fill from GitLab later', function () {
    $this->post(route('rooms.store'), ['host_name' => 'Olivier', 'stories' => []])
        ->assertSessionHasNoErrors();

    $room = Room::query()->firstOrFail();
    expect($room->stories)->toHaveCount(0);
    expect($room->current_story_id)->toBeNull();
});

it('lets a guest join a room with just a name', function () {
    $room = Room::factory()->create();

    $response = $this->post(route('rooms.join', $room), ['name' => 'Maya']);

    $response->assertRedirect(route('rooms.show', $room));
    $participant = $room->participants()->firstOrFail();
    $this->assertSame('Maya', $participant->name);
    $this->assertFalse($participant->is_host);
    $this->assertSame($participant->id, session(CurrentRoomParticipant::sessionKey($room)));
    Event::assertDispatched(RoomUpdated::class);
});

it('shows a join gate (no me) until a guest joins', function () {
    $this->withoutVite();
    $room = Room::factory()->create();

    $this->get(route('rooms.show', $room))
        ->assertInertia(fn ($page) => $page
            ->component('poker')
            ->where('room.me', null)
            ->where('room.code', $room->code));
});

it('lets a participant cast a vote during a voting round', function () {
    $room = Room::factory()->create();
    $story = RoomStory::factory()->for($room)->create();
    $round = RoomRound::factory()->for($room)->create(['room_story_id' => $story->id]);
    $room->update(['current_story_id' => $story->id, 'current_round_id' => $round->id]);
    $participant = RoomParticipant::factory()->for($room)->create();

    joinAs($room, $participant);

    $this->post(route('rooms.votes.store', $room), ['value' => '5'])
        ->assertRedirect();

    $this->assertDatabaseHas('room_votes', [
        'room_round_id' => $round->id,
        'room_participant_id' => $participant->id,
        'value' => '5',
    ]);
    Event::assertDispatched(RoomUpdated::class);
});

it('hides vote values from the presenter until the round is revealed', function () {
    $room = Room::factory()->create();
    $story = RoomStory::factory()->for($room)->create();
    $round = RoomRound::factory()->for($room)->create(['room_story_id' => $story->id]);
    $room->update(['current_story_id' => $story->id, 'current_round_id' => $round->id]);
    $voter = RoomParticipant::factory()->for($room)->create();
    $round->votes()->create(['room_participant_id' => $voter->id, 'value' => '8']);

    $voting = app(RoomPresenter::class)->for($room->fresh(), null);
    $votingPlayer = collect($voting['players'])->firstWhere('id', $voter->id);
    expect($votingPlayer['has_voted'])->toBeTrue();
    expect($votingPlayer['vote'])->toBeNull();

    $round->update(['status' => VotingRoundStatus::Revealed, 'revealed_at' => now()]);

    $revealed = app(RoomPresenter::class)->for($room->fresh(), null);
    $revealedPlayer = collect($revealed['players'])->firstWhere('id', $voter->id);
    expect($revealedPlayer['vote'])->toBe('8');
});

it('lets the host reveal a round but forbids non-hosts', function () {
    $room = Room::factory()->create();
    $story = RoomStory::factory()->for($room)->create();
    $round = RoomRound::factory()->for($room)->create(['room_story_id' => $story->id]);
    $host = RoomParticipant::factory()->for($room)->host()->create();
    $guest = RoomParticipant::factory()->for($room)->create();

    joinAs($room, $guest);
    $this->post(route('rooms.rounds.reveal', [$room, $round]))->assertForbidden();

    joinAs($room, $host);
    $this->post(route('rooms.rounds.reveal', [$room, $round]))->assertRedirect();

    expect($round->fresh()->status)->toBe(VotingRoundStatus::Revealed);
});

it('lets the host accept an estimate and advances to the next story', function () {
    $room = Room::factory()->create();
    $first = RoomStory::factory()->for($room)->create(['position' => 0]);
    $second = RoomStory::factory()->for($room)->create(['position' => 1]);
    $round = RoomRound::factory()->for($room)->revealed()->create(['room_story_id' => $first->id]);
    $room->update(['current_story_id' => $first->id, 'current_round_id' => $round->id]);
    $host = RoomParticipant::factory()->for($room)->host()->create();
    $round->votes()->create(['room_participant_id' => $host->id, 'value' => '5']);

    joinAs($room, $host);

    $this->post(route('rooms.rounds.accept', [$room, $round]), ['estimate' => '5'])
        ->assertRedirect();

    expect($first->fresh()->status)->toBe(StoryStatus::Estimated);
    expect($first->fresh()->final_estimate)->toBe('5');
    expect($room->fresh()->current_story_id)->toBe($second->id);
});

it('marks the room completed when the last story is accepted', function () {
    $room = Room::factory()->create();
    $story = RoomStory::factory()->for($room)->create();
    $round = RoomRound::factory()->for($room)->revealed()->create(['room_story_id' => $story->id]);
    $room->update(['current_story_id' => $story->id, 'current_round_id' => $round->id]);
    $host = RoomParticipant::factory()->for($room)->host()->create();
    $round->votes()->create(['room_participant_id' => $host->id, 'value' => '3']);

    joinAs($room, $host);

    $this->post(route('rooms.rounds.accept', [$room, $round]), ['estimate' => '3'])
        ->assertRedirect();

    expect($room->fresh()->status)->toBe(RoomStatus::Completed);
});

it('forbids non-hosts from managing stories and starting rounds', function () {
    $room = Room::factory()->create();
    $story = RoomStory::factory()->for($room)->create();
    $guest = RoomParticipant::factory()->for($room)->create();

    joinAs($room, $guest);

    $this->post(route('rooms.stories.store', $room), [
        'stories' => [['title' => 'Sneaky']],
    ])->assertForbidden();

    $this->post(route('rooms.rounds.store', $room), [
        'story_id' => $story->id,
    ])->assertForbidden();
});
