<?php

namespace App\Http\Requests;

use App\Models\PlanningSession;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreVotingRoundRequest extends FormRequest
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
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        $planningSession = $this->route('planningSession');
        $planningSessionId = $planningSession instanceof PlanningSession
            ? $planningSession->id
            : null;

        return [
            'story_id' => [
                'required',
                'integer',
                Rule::exists('stories', 'id')->where('planning_session_id', $planningSessionId),
            ],
        ];
    }
}
