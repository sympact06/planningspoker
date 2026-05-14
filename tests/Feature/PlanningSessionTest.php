<?php

use App\Enums\PlanningSessionStatus;
use App\Enums\StoryStatus;
use App\Enums\TeamRole;
use App\Enums\VotingRoundStatus;
use App\Events\SessionUpdated;
use App\Models\PlanningSession;
use App\Models\Story;
use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Facades\Event;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->withoutVite();
});

/**
 * @return array{team: Team, owner: User, member: User, outsider: User}
 */
function planningTeamFixture(): array
{
    $owner = User::factory()->create([
        'name' => 'Ada Owner',
    ]);
    $member = User::factory()->create([
        'name' => 'Bert Member',
    ]);
    $outsider = User::factory()->create([
        'name' => 'Cara Outsider',
    ]);
    $team = Team::factory()->create([
        'name' => 'Product Team',
    ]);

    $team->users()->attach($owner->id, ['role' => TeamRole::Owner->value]);
    $team->users()->attach($member->id, ['role' => TeamRole::Member->value]);

    return compact('team', 'owner', 'member', 'outsider');
}

test('owner can create a planning session with imported stories', function () {
    ['team' => $team, 'owner' => $owner] = planningTeamFixture();
    Event::fake([SessionUpdated::class]);

    $response = $this->actingAs($owner)->post(route('sessions.store'), [
        'team_id' => $team->id,
        'name' => 'Sprint refinement',
        'stories' => [
            ['key' => 'POK-101', 'title' => 'Realtime votes'],
            ['key' => 'POK-102', 'title' => 'Accept estimate'],
        ],
    ]);

    $planningSession = PlanningSession::query()->firstOrFail();
    $firstStory = $planningSession->stories()->orderBy('position')->firstOrFail();

    $response->assertRedirect(route('sessions.show', $planningSession));
    expect($planningSession->team_id)->toBe($team->id)
        ->and($planningSession->facilitator_id)->toBe($owner->id)
        ->and($planningSession->status)->toBe(PlanningSessionStatus::Active)
        ->and($planningSession->stories()->count())->toBe(2)
        ->and($planningSession->current_story_id)->toBe($firstStory->id);

    Event::assertDispatched(
        SessionUpdated::class,
        fn (SessionUpdated $event): bool => $event->planningSessionId === $planningSession->id,
    );
});

test('members can view a session and non members are forbidden', function () {
    ['team' => $team, 'owner' => $owner, 'member' => $member, 'outsider' => $outsider] = planningTeamFixture();
    $planningSession = PlanningSession::factory()
        ->for($team)
        ->for($owner, 'facilitator')
        ->create();

    Story::factory()->for($planningSession)->create([
        'title' => 'Team access',
        'position' => 0,
    ]);

    $this->actingAs($member)
        ->get(route('sessions.show', $planningSession))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('sessions/show')
            ->where('session.id', $planningSession->id)
        );

    $this->actingAs($outsider)
        ->get(route('sessions.show', $planningSession))
        ->assertForbidden();
});

test('facilitator can run voting lifecycle while votes stay hidden before reveal', function () {
    ['team' => $team, 'owner' => $owner, 'member' => $member] = planningTeamFixture();
    Event::fake([SessionUpdated::class]);

    $planningSession = PlanningSession::factory()
        ->for($team)
        ->for($owner, 'facilitator')
        ->create();
    $story = Story::factory()->for($planningSession)->create([
        'key' => 'POK-201',
        'title' => 'Hidden votes',
        'position' => 0,
    ]);
    $planningSession->update([
        'current_story_id' => $story->id,
    ]);

    $this->actingAs($owner)
        ->post(route('sessions.rounds.store', $planningSession), [
            'story_id' => $story->id,
        ])
        ->assertRedirect();

    $round = $planningSession->fresh()->currentVotingRound;

    $this->actingAs($owner)
        ->post(route('sessions.votes.store', $planningSession), ['value' => '5'])
        ->assertRedirect();
    $this->actingAs($member)
        ->post(route('sessions.votes.store', $planningSession), ['value' => '3'])
        ->assertRedirect();

    $this->actingAs($member)
        ->get(route('sessions.show', $planningSession))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('session.current_round.status', VotingRoundStatus::Voting->value)
            ->where('session.current_round.votes.0.has_voted', true)
            ->where('session.current_round.votes.0.value', null)
            ->where('session.current_round.votes.1.has_voted', true)
            ->where('session.current_round.votes.1.value', null)
        );

    $this->actingAs($owner)
        ->post(route('sessions.rounds.reveal', [$planningSession, $round]))
        ->assertRedirect();

    $this->actingAs($member)
        ->get(route('sessions.show', $planningSession))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('session.current_round.status', VotingRoundStatus::Revealed->value)
            ->where('session.current_round.votes.0.value', '5')
            ->where('session.current_round.votes.1.value', '3')
        );

    $this->actingAs($owner)
        ->post(route('sessions.rounds.accept', [$planningSession, $round]), [
            'estimate' => '5',
        ])
        ->assertRedirect();

    expect($story->fresh()->status)->toBe(StoryStatus::Estimated)
        ->and($story->fresh()->final_estimate)->toBe('5')
        ->and($round->fresh()->status)->toBe(VotingRoundStatus::Accepted);

    Event::assertDispatched(SessionUpdated::class);
});

test('members cannot facilitate rounds or complete sessions', function () {
    ['team' => $team, 'owner' => $owner, 'member' => $member] = planningTeamFixture();
    $planningSession = PlanningSession::factory()
        ->for($team)
        ->for($owner, 'facilitator')
        ->create();
    $story = Story::factory()->for($planningSession)->create();

    $this->actingAs($member)
        ->post(route('sessions.rounds.store', $planningSession), [
            'story_id' => $story->id,
        ])
        ->assertForbidden();

    $this->actingAs($member)
        ->post(route('sessions.complete', $planningSession))
        ->assertForbidden();
});

test('facilitator can import stories after session creation', function () {
    ['team' => $team, 'owner' => $owner] = planningTeamFixture();
    $planningSession = PlanningSession::factory()
        ->for($team)
        ->for($owner, 'facilitator')
        ->create([
            'current_story_id' => null,
        ]);

    $this->actingAs($owner)
        ->post(route('sessions.stories.store', $planningSession), [
            'stories' => [
                ['key' => 'POK-301', 'title' => 'Import story'],
            ],
        ])
        ->assertRedirect();

    $story = $planningSession->stories()->firstOrFail();

    expect($story->key)->toBe('POK-301')
        ->and($planningSession->fresh()->current_story_id)->toBe($story->id);
});
