<?php

namespace App\Http\Controllers;

use App\Enums\PlanningSessionStatus;
use App\Enums\StoryStatus;
use App\Events\SessionUpdated;
use App\Http\Requests\StorePlanningSessionRequest;
use App\Models\PlanningSession;
use App\Models\Story;
use App\Models\Team;
use App\Models\User;
use App\Support\DefaultTeam;
use App\Support\PlanningSessionPresenter;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class PlanningSessionController extends Controller
{
    public function create(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();

        DefaultTeam::ensureFor($user);

        return Inertia::render('sessions/create', [
            'teams' => $user->teams()
                ->orderBy('name')
                ->get()
                ->map(fn (Team $team): array => [
                    'id' => $team->id,
                    'name' => $team->name,
                    'role' => $team->pivot->role,
                ])
                ->all(),
        ]);
    }

    public function store(StorePlanningSessionRequest $request): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();
        $validated = $request->validated();

        $planningSession = DB::transaction(function () use ($user, $validated): PlanningSession {
            $planningSession = PlanningSession::create([
                'team_id' => $validated['team_id'],
                'facilitator_id' => $user->id,
                'name' => $validated['name'],
                'status' => PlanningSessionStatus::Active,
            ]);

            $firstStory = null;

            foreach ($this->normalizeStories($validated['stories'] ?? []) as $index => $storyData) {
                $story = Story::create([
                    'planning_session_id' => $planningSession->id,
                    'key' => $storyData['key'],
                    'title' => $storyData['title'],
                    'position' => $index,
                    'status' => StoryStatus::Pending,
                ]);

                $firstStory ??= $story;
            }

            if ($firstStory instanceof Story) {
                $planningSession->update([
                    'current_story_id' => $firstStory->id,
                ]);
            }

            return $planningSession;
        });

        SessionUpdated::dispatch($planningSession->id);

        return to_route('sessions.show', $planningSession);
    }

    public function show(
        Request $request,
        PlanningSession $planningSession,
        PlanningSessionPresenter $presenter,
    ): Response {
        $this->authorize('view', $planningSession);

        /** @var User $user */
        $user = $request->user();

        return Inertia::render('sessions/show', [
            'session' => $presenter->for($planningSession, $user),
        ]);
    }

    public function complete(PlanningSession $planningSession): RedirectResponse
    {
        $this->authorize('complete', $planningSession);

        $planningSession->update([
            'status' => PlanningSessionStatus::Completed,
            'completed_at' => now(),
        ]);

        SessionUpdated::dispatch($planningSession->id);

        return back();
    }

    /**
     * @param  array<int, array{key?: string|null, title?: string|null}>  $stories
     * @return list<array{key: string|null, title: string}>
     */
    private function normalizeStories(array $stories): array
    {
        return collect($stories)
            ->map(fn (array $story): array => [
                'key' => filled($story['key'] ?? null) ? trim((string) $story['key']) : null,
                'title' => trim((string) ($story['title'] ?? '')),
            ])
            ->filter(fn (array $story): bool => $story['title'] !== '')
            ->values()
            ->all();
    }
}
