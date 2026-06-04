<?php

namespace App\Services\GitLab;

use App\Models\RoomGitlabConnection;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Thin wrapper around the GitLab REST API (v4) authenticated with a room host's
 * OAuth access token. Refreshes the token transparently when it has expired.
 */
final class GitLabClient
{
    public function __construct(private readonly RoomGitlabConnection $connection) {}

    public static function forConnection(RoomGitlabConnection $connection): self
    {
        return new self($connection);
    }

    /**
     * Projects the connected user is a member of, optionally filtered by search.
     *
     * @return list<array{id: int, name: string, path: string}>
     */
    public function projects(?string $search = null): array
    {
        $response = $this->request()->get('/projects', array_filter([
            'membership' => true,
            'simple' => true,
            'order_by' => 'last_activity_at',
            'per_page' => 100,
            'search' => filled($search) ? $search : null,
        ]));

        return collect($response->json())
            ->map(fn (array $project): array => [
                'id' => (int) $project['id'],
                'name' => (string) ($project['name_with_namespace'] ?? $project['name'] ?? ''),
                'path' => (string) ($project['path_with_namespace'] ?? ''),
            ])
            ->all();
    }

    /**
     * Milestones, labels and iterations for a project in a single payload so the
     * picker can populate all of its filters at once.
     *
     * @return array{milestones: list<array{id: int, title: string}>, labels: list<array{name: string, color: string}>, iterations: list<array{id: int, title: string}>}
     */
    public function meta(int $projectId): array
    {
        return [
            'milestones' => $this->milestones($projectId),
            'labels' => $this->labels($projectId),
            'iterations' => $this->iterations($projectId),
        ];
    }

    /**
     * @return list<array{id: int, title: string}>
     */
    public function milestones(int $projectId): array
    {
        $response = $this->request()->get("/projects/{$projectId}/milestones", [
            'state' => 'active',
            'per_page' => 100,
        ]);

        return collect($response->json())
            ->map(fn (array $milestone): array => [
                'id' => (int) $milestone['id'],
                'title' => (string) $milestone['title'],
            ])
            ->all();
    }

    /**
     * @return list<array{name: string, color: string}>
     */
    public function labels(int $projectId): array
    {
        $response = $this->request()->get("/projects/{$projectId}/labels", [
            'per_page' => 100,
        ]);

        return collect($response->json())
            ->map(fn (array $label): array => [
                'name' => (string) $label['name'],
                'color' => (string) ($label['color'] ?? '#888888'),
            ])
            ->all();
    }

    /**
     * Iterations degrade gracefully: they require GitLab Premium and a specific
     * version, so a non-2xx response simply yields an empty list.
     *
     * @return list<array{id: int, title: string}>
     */
    public function iterations(int $projectId): array
    {
        try {
            $response = $this->request()->get("/projects/{$projectId}/iterations", [
                'state' => 'opened',
                'per_page' => 100,
            ]);

            if (! $response->successful()) {
                return [];
            }

            return collect($response->json())
                ->map(fn (array $iteration): array => [
                    'id' => (int) $iteration['id'],
                    'title' => (string) ($iteration['title'] ?: 'Iteration '.$iteration['id']),
                ])
                ->all();
        } catch (Throwable $exception) {
            Log::warning('GitLab iterations unavailable', ['message' => $exception->getMessage()]);

            return [];
        }
    }

    /**
     * Open issues for a project, filtered for the picker.
     *
     * @param  array{milestone?: string|null, labels?: string|null, iteration_id?: int|null, search?: string|null}  $filters
     * @return list<array{project_id: int, iid: int, title: string, web_url: string, weight: int|null, reference: string}>
     */
    public function issues(int $projectId, array $filters = []): array
    {
        $response = $this->request()->get("/projects/{$projectId}/issues", array_filter([
            'state' => 'opened',
            'with_labels_details' => false,
            'per_page' => 100,
            'order_by' => 'updated_at',
            'milestone' => $filters['milestone'] ?? null,
            'labels' => $filters['labels'] ?? null,
            'iteration_id' => $filters['iteration_id'] ?? null,
            'search' => $filters['search'] ?? null,
        ], fn ($value): bool => $value !== null && $value !== ''));

        return collect($response->json())
            ->map(fn (array $issue): array => [
                'project_id' => $projectId,
                'iid' => (int) $issue['iid'],
                'title' => (string) $issue['title'],
                'web_url' => (string) ($issue['web_url'] ?? ''),
                'weight' => isset($issue['weight']) ? (int) $issue['weight'] : null,
                'reference' => (string) ($issue['references']['full'] ?? '#'.$issue['iid']),
            ])
            ->all();
    }

    /**
     * Push the agreed estimate to the issue's weight. Returns false (without
     * throwing) when GitLab rejects the update, e.g. because weight requires a
     * paid tier on this project.
     */
    public function updateIssueWeight(int $projectId, int $iid, int $weight): bool
    {
        $response = $this->request()->put("/projects/{$projectId}/issues/{$iid}", [
            'weight' => $weight,
        ]);

        if (! $response->successful()) {
            Log::warning('GitLab weight update failed', [
                'project_id' => $projectId,
                'iid' => $iid,
                'status' => $response->status(),
            ]);
        }

        return $response->successful();
    }

    /**
     * A pending request authenticated with a guaranteed-fresh access token.
     */
    private function request(): PendingRequest
    {
        $this->ensureFreshToken();

        return Http::baseUrl(rtrim((string) config('services.gitlab.host'), '/').'/api/v4')
            ->withToken($this->connection->access_token)
            ->acceptJson()
            ->retry(2, 200, throw: false);
    }

    /**
     * Refresh and persist the access token when it has expired.
     */
    private function ensureFreshToken(): void
    {
        if (! $this->connection->isExpired() || blank($this->connection->refresh_token)) {
            return;
        }

        $response = Http::asForm()->post(rtrim((string) config('services.gitlab.host'), '/').'/oauth/token', [
            'grant_type' => 'refresh_token',
            'refresh_token' => $this->connection->refresh_token,
            'client_id' => config('services.gitlab.client_id'),
            'client_secret' => config('services.gitlab.client_secret'),
            'redirect_uri' => config('services.gitlab.redirect'),
        ]);

        if (! $response->successful()) {
            Log::warning('GitLab token refresh failed', ['status' => $response->status()]);

            return;
        }

        $this->connection->forceFill([
            'access_token' => $response->json('access_token'),
            'refresh_token' => $response->json('refresh_token') ?? $this->connection->refresh_token,
            'token_expires_at' => ($expiresIn = $response->json('expires_in'))
                ? now()->addSeconds((int) $expiresIn)
                : null,
        ])->save();
    }
}
