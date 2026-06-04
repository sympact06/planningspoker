<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\AuthorizesRoomParticipant;
use Illuminate\Foundation\Http\FormRequest;

class StoreRoomStoryRequest extends FormRequest
{
    use AuthorizesRoomParticipant;

    /**
     * Only the host may manage the backlog.
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
            'stories' => ['required', 'array', 'min:1', 'max:100'],
            'stories.*.key' => ['nullable', 'string', 'max:50'],
            'stories.*.title' => ['required', 'string', 'max:255'],
        ];
    }
}
