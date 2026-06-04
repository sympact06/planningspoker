<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class JoinRoomRequest extends FormRequest
{
    /**
     * Anyone with the link may join — no account required.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:50'],
        ];
    }
}
