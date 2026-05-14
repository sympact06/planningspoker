<?php

namespace App\Http\Controllers;

use App\Enums\PlanningSessionStatus;
use App\Enums\StoryStatus;
use App\Models\PlanningSession;
use App\Models\Story;
use App\Models\User;
use App\Support\DefaultTeam;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();

        DefaultTeam::ensureFor($user);

        $teams = $user->teams()
            ->withCount(['users', 'planningSessions'])
            ->orderBy('name')
            ->get();

        $teamIds = $teams->pluck('id');

        $activeSessions = PlanningSession::query()
            ->with(['team', 'facilitator', 'currentStory'])
            ->whereIn('team_id', $teamIds)
            ->where('status', PlanningSessionStatus::Active->value)
            ->latest()
            ->take(6)
            ->get();

        $recentSessions = PlanningSession::query()
            ->with(['team', 'facilitator', 'currentStory'])
            ->withCount(['stories'])
            ->whereIn('team_id', $teamIds)
            ->latest()
            ->take(8)
            ->get();

        $totalStories = Story::query()
            ->whereHas('planningSession', fn ($query) => $query->whereIn('team_id', $teamIds))
            ->count();

        $estimatedStories = Story::query()
            ->where('status', StoryStatus::Estimated->value)
            ->whereHas('planningSession', fn (Builder $query) => $query->whereIn('team_id', $teamIds))
            ->count();

        $latestEstimates = Story::query()
            ->with('planningSession.team')
            ->whereNotNull('final_estimate')
            ->whereHas('planningSession', fn ($query) => $query->whereIn('team_id', $teamIds))
            ->latest('updated_at')
            ->take(5)
            ->get();

        return Inertia::render('dashboard', [
            'teams' => $teams->map(fn ($team): array => [
                'id' => $team->id,
                'name' => $team->name,
                'role' => $team->pivot->role,
                'users_count' => $team->users_count,
                'planning_sessions_count' => $team->planning_sessions_count,
            ])->all(),
            'activeSessions' => $activeSessions->map(fn (PlanningSession $planningSession): array => $this->sessionSummary($planningSession))->all(),
            'recentSessions' => $recentSessions->map(fn (PlanningSession $planningSession): array => $this->sessionSummary($planningSession))->all(),
            'stats' => [
                'teams' => $teams->count(),
                'active_sessions' => $activeSessions->count(),
                'total_stories' => $totalStories,
                'estimated_stories' => $estimatedStories,
                'completion_percentage' => $totalStories > 0
                    ? (int) round(($estimatedStories / $totalStories) * 100)
                    : 0,
            ],
            'latestEstimates' => $latestEstimates->map(fn (Story $story): array => [
                'id' => $story->id,
                'key' => $story->key,
                'title' => $story->title,
                'estimate' => $story->final_estimate,
                'session' => [
                    'id' => $story->planningSession->id,
                    'name' => $story->planningSession->name,
                    'team' => $story->planningSession->team->name,
                ],
            ])->all(),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function sessionSummary(PlanningSession $planningSession): array
    {
        return [
            'id' => $planningSession->id,
            'name' => $planningSession->name,
            'status' => $planningSession->status->value,
            'team' => $planningSession->team->name,
            'facilitator' => $planningSession->facilitator?->name,
            'current_story' => $planningSession->currentStory?->title,
            'stories_count' => $planningSession->stories_count ?? null,
            'updated_at' => $planningSession->updated_at?->toISOString(),
        ];
    }
}
