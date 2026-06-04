<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\AuthorizesRoomParticipant;
use App\Models\Room;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreRoomRoundRequest extends FormRequest
{
    use AuthorizesRoomParticipant;

    /**
     * Only the host may start a voting round.
     */
    public function authorize(): bool
    {
        return $this->participantIsHost();
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        $room = $this->room();
        $roomId = $room instanceof Room ? $room->id : null;

        return [
            'story_id' => [
                'required',
                'integer',
                Rule::exists('room_stories', 'id')->where('room_id', $roomId),
            ],
        ];
    }
}
