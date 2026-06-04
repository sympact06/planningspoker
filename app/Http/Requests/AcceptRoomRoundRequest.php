<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\AuthorizesRoomParticipant;
use Illuminate\Foundation\Http\FormRequest;

class AcceptRoomRoundRequest extends FormRequest
{
    use AuthorizesRoomParticipant;

    /**
     * Only the host may accept an estimate.
     */
    public function authorize(): bool
    {
        return $this->participantIsHost();
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'estimate' => ['nullable', 'string', 'max:16'],
        ];
    }
}
