<?php

namespace App\Jobs;

use App\Models\RoomStory;
use App\Services\GitLab\GitLabClient;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Pushes a story's agreed estimate to its linked GitLab issue as the issue
 * weight (Fibonacci value maps to weight 1:1). Non-numeric estimates ("?",
 * "coffee") and unlinked / unconnected stories are skipped.
 */
class SyncStoryWeightToGitLab implements ShouldQueue
{
    use Queueable;

    /**
     * @var int
     */
    public $tries = 3;

    /**
     * @var array<int, int>
     */
    public $backoff = [10, 60, 180];

    public function __construct(public RoomStory $story) {}

    public function handle(): void
    {
        $story = $this->story->fresh();

        if (! $story instanceof RoomStory || ! $story->isLinkedToGitLab()) {
            return;
        }

        if (! is_numeric($story->final_estimate)) {
            return;
        }

        $connection = $story->room?->gitlabConnection;

        if ($connection === null) {
            return;
        }

        $updated = GitLabClient::forConnection($connection)->updateIssueWeight(
            (int) $story->gitlab_project_id,
            (int) $story->gitlab_issue_iid,
            (int) $story->final_estimate,
        );

        if ($updated) {
            $story->forceFill(['gitlab_synced_at' => now()])->save();
        }
    }
}
