<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\EnsuresRoomHost;
use App\Models\Room;
use App\Models\RoomGitlabConnection;
use App\Services\GitLab\GitLabClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Read-only GitLab data for the issue picker. Every endpoint is host-only and
 * proxies through the room's stored OAuth credentials.
 */
class GitLabBrowseController extends Controller
{
    use EnsuresRoomHost;

    public function projects(Request $request, Room $room): JsonResponse
    {
        $client = $this->clientFor($request, $room);

        return response()->json([
            'projects' => $client->projects($request->string('search')->toString() ?: null),
        ]);
    }

    public function meta(Request $request, Room $room): JsonResponse
    {
        $projectId = (int) $request->integer('project_id');
        abort_if($projectId <= 0, 422);

        return response()->json(
            $this->clientFor($request, $room)->meta($projectId),
        );
    }

    public function issues(Request $request, Room $room): JsonResponse
    {
        $projectId = (int) $request->integer('project_id');
        abort_if($projectId <= 0, 422);

        $labels = $request->input('labels');

        $issues = $this->clientFor($request, $room)->issues($projectId, [
            'milestone' => $request->string('milestone')->toString() ?: null,
            'labels' => is_array($labels) ? implode(',', $labels) : ($labels ?: null),
            'iteration_id' => $request->filled('iteration_id') ? (int) $request->integer('iteration_id') : null,
            'search' => $request->string('search')->toString() ?: null,
        ]);

        return response()->json(['issues' => $issues]);
    }

    private function clientFor(Request $request, Room $room): GitLabClient
    {
        $this->ensureHost($request, $room);

        $connection = $room->gitlabConnection;

        abort_unless($connection instanceof RoomGitlabConnection, 409, 'GitLab is niet gekoppeld.');

        return GitLabClient::forConnection($connection);
    }
}
