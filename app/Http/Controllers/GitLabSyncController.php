<?php

namespace App\Http\Controllers;

use App\Enums\StoryStatus;
use App\Http\Controllers\Concerns\EnsuresRoomHost;
use App\Jobs\SyncStoryWeightToGitLab;
use App\Models\Room;
use App\Models\RoomStory;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class GitLabSyncController extends Controller
{
    use EnsuresRoomHost;

    /**
     * Host safety net: (re)push the weight of every estimated, GitLab-linked
     * story in the room.
     */
    public function store(Request $request, Room $room): RedirectResponse
    {
        $this->ensureHost($request, $room);

        $room->stories()
            ->where('status', StoryStatus::Estimated->value)
            ->whereNotNull('gitlab_issue_iid')
            ->get()
            ->each(function (RoomStory $story): void {
                if (is_numeric($story->final_estimate)) {
                    SyncStoryWeightToGitLab::dispatch($story);
                }
            });

        return back();
    }
}
