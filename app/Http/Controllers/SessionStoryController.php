<?php

namespace App\Http\Controllers;

use App\Enums\StoryStatus;
use App\Events\SessionUpdated;
use App\Http\Requests\StoreStoryRequest;
use App\Models\PlanningSession;
use App\Models\Story;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;

class SessionStoryController extends Controller
{
    public function store(StoreStoryRequest $request, PlanningSession $planningSession): RedirectResponse
    {
        $validated = $request->validated();

        DB::transaction(function () use ($planningSession, $validated): void {
            $maxPosition = $planningSession->stories()->max('position');
            $position = $maxPosition === null ? 0 : ((int) $maxPosition) + 1;
            $firstStory = null;

            foreach ($validated['stories'] as $storyData) {
                $story = Story::create([
                    'planning_session_id' => $planningSession->id,
                    'key' => filled($storyData['key'] ?? null) ? trim((string) $storyData['key']) : null,
                    'title' => trim((string) $storyData['title']),
                    'position' => $position++,
                    'status' => StoryStatus::Pending,
                ]);

                $firstStory ??= $story;
            }

            if ($planningSession->current_story_id === null && $firstStory instanceof Story) {
                $planningSession->update([
                    'current_story_id' => $firstStory->id,
                ]);
            }
        });

        SessionUpdated::dispatch($planningSession->id);

        return back();
    }
}
