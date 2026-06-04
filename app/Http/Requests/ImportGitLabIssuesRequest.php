<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\AuthorizesRoomParticipant;
use Illuminate\Foundation\Http\FormRequest;

class ImportGitLabIssuesRequest extends FormRequest
{
    use AuthorizesRoomParticipant;

    /**
     * Only the host may import issues into the room.
     */
    public function authorize(): bool
    {
        return $this->participantIsHost();
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'issues' => ['required', 'array', 'min:1', 'max:100'],
            'issues.*.project_id' => ['required', 'integer', 'min:1'],
            'issues.*.iid' => ['required', 'integer', 'min:1'],
            'issues.*.title' => ['required', 'string', 'max:255'],
            'issues.*.web_url' => ['nullable', 'string', 'max:2048'],
            'issues.*.reference' => ['nullable', 'string', 'max:255'],
        ];
    }
}
