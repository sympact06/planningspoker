<?php

namespace App\Http\Controllers;

use App\Enums\StoryStatus;
use App\Events\RoomUpdated;
use App\Http\Requests\ImportGitLabIssuesRequest;
use App\Models\Room;
use App\Models\RoomStory;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;

class GitLabImportController extends Controller
{
    /**
     * Append the selected GitLab issues to the room backlog as stories. Issues
     * already linked in this room are skipped so re-importing is safe.
     */
    public function store(ImportGitLabIssuesRequest $request, Room $room): RedirectResponse
    {
        $issues = collect($request->validated('issues'));

        DB::transaction(function () use ($room, $issues): void {
            $existing = $room->stories()
                ->whereNotNull('gitlab_issue_iid')
                ->get(['gitlab_project_id', 'gitlab_issue_iid'])
                ->map(fn (RoomStory $story): string => $story->gitlab_project_id.':'.$story->gitlab_issue_iid)
                ->all();

            $position = (int) $room->stories()->max('position');

            $firstCreated = null;

            foreach ($issues as $issue) {
                $identity = $issue['project_id'].':'.$issue['iid'];

                if (in_array($identity, $existing, true)) {
                    continue;
                }

                $existing[] = $identity;

                $story = $room->stories()->create([
                    'key' => $this->referenceFor($issue),
                    'gitlab_project_id' => $issue['project_id'],
                    'gitlab_issue_iid' => $issue['iid'],
                    'gitlab_web_url' => $issue['web_url'] ?? null,
                    'title' => trim((string) $issue['title']),
                    'position' => ++$position,
                    'status' => StoryStatus::Pending,
                ]);

                $firstCreated ??= $story;
            }

            if ($firstCreated instanceof RoomStory && $room->current_story_id === null) {
                $room->update(['current_story_id' => $firstCreated->id]);
            }
        });

        RoomUpdated::dispatch($room->code);

        return back();
    }

    /**
     * A short, unique-per-room display key for the story, capped at the column
     * length. Falls back to "#iid" when no full reference is given.
     *
     * @param  array{iid: int, reference?: string|null}  $issue
     */
    private function referenceFor(array $issue): string
    {
        $reference = filled($issue['reference'] ?? null)
            ? (string) $issue['reference']
            : '#'.$issue['iid'];

        return mb_substr($reference, 0, 50);
    }
}
