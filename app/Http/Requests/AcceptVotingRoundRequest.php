<?php

namespace App\Http\Requests;

use App\Enums\VoteValue;
use App\Models\PlanningSession;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AcceptVotingRoundRequest extends FormRequest
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
        return [
            'estimate' => ['nullable', Rule::in(VoteValue::estimateValues())],
        ];
    }
}
