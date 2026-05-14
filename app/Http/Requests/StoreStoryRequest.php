<?php

namespace App\Http\Requests;

use App\Models\PlanningSession;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;

class StoreStoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        $planningSession = $this->route('planningSession');

        return $user instanceof User
            && $planningSession instanceof PlanningSession
            && $user->can('facilitate', $planningSession);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'stories' => ['required', 'array', 'min:1', 'max:100'],
            'stories.*.key' => ['nullable', 'string', 'max:50'],
            'stories.*.title' => ['required', 'string', 'max:255'],
        ];
    }
}
