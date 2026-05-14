<?php

namespace App\Http\Requests;

use App\Models\Team;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;

class StorePlanningSessionRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        $team = Team::query()->find($this->integer('team_id'));

        return $user instanceof User
            && $team instanceof Team
            && $user->can('view', $team);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'team_id' => ['required', 'integer', 'exists:teams,id'],
            'name' => ['required', 'string', 'max:255'],
            'stories' => ['nullable', 'array', 'max:100'],
            'stories.*.key' => ['nullable', 'string', 'max:50'],
            'stories.*.title' => ['required', 'string', 'max:255'],
        ];
    }
}
