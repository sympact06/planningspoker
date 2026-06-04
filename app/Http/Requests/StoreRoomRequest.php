<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreRoomRequest extends FormRequest
{
    /**
     * Anyone may create a room — no account required.
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
            'name' => ['nullable', 'string', 'max:255'],
            'host_name' => ['nullable', 'string', 'max:50'],
            'stories' => ['nullable', 'array', 'max:100'],
            'stories.*.key' => ['nullable', 'string', 'max:50'],
            'stories.*.title' => ['required', 'string', 'max:255'],
        ];
    }
}
