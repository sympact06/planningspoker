<?php

namespace App\Http\Requests;

use App\Enums\VoteValue;
use App\Http\Requests\Concerns\AuthorizesRoomParticipant;
use App\Models\RoomParticipant;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreRoomVoteRequest extends FormRequest
{
    use AuthorizesRoomParticipant;

    /**
     * Any participant who has joined the room may vote.
     */
    public function authorize(): bool
    {
        return $this->participant() instanceof RoomParticipant;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'value' => ['required', Rule::in(VoteValue::values())],
        ];
    }
}
